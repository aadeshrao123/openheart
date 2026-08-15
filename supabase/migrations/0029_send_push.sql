-- OpenHeart :: actually sending the notifications
--
-- 0019 created push_tokens and said in its own header that nothing sends
-- anything yet. That stayed true. The table has been an empty shell, which is
-- the same shape as an images binding that was declared and never deployed:
-- half of a pair, and nothing anywhere reports the other half missing.
--
-- The send path is a trigger, because the client must not be trusted with it.
-- A client that could ask the server to notify somebody could notify anybody.
--
-- pg_net rather than a queue drained on a schedule. A match or a message is
-- worth nothing an hour later, and net.http_post does not start the request
-- until the transaction commits, so a notification can never describe a write
-- that was rolled back.

create extension if not exists pg_net;

-- ------------------------------------------------------------------ locale
--
-- The server writes the notification text, so the server has to know which
-- language to write it in. Nothing else in the system needs this: every other
-- string is resolved on the device by i18next.
--
-- Nullable, and read with a fallback, per the schema-as-API rule.

alter table push_tokens add column locale text;

-- Replaced rather than overloaded. Two functions differing only by a defaulted
-- argument are ambiguous to PostgREST, which resolves by argument name.
drop function if exists register_push_token(text, text);

create or replace function register_push_token(
  push_token text,
  device     text,
  locale     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into push_tokens (token, profile_id, platform, locale)
  values (push_token, me, device, locale)
  on conflict (token) do update
     set profile_id = me,
         platform   = excluded.platform,
         locale     = excluded.locale,
         last_seen  = now();
end;
$$;

revoke all on function register_push_token(text, text, text) from public;
grant execute on function register_push_token(text, text, text) to authenticated;

-- ------------------------------------------------------------------- the call
--
-- The endpoint and the shared secret live in Vault rather than in this file,
-- which is public. Set them once per environment:
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push',
--                              'push_function_url');
--   select vault.create_secret('<same value as the PUSH_SECRET function secret>',
--                              'push_hook_secret');
--
-- Absent, this does nothing at all. That is deliberate and it is the most
-- important line in the file: a notification that cannot be sent must never be
-- able to fail the message that prompted it.

create or replace function public.queue_push(recipient uuid, kind text, thread uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  endpoint text;
  secret   text;
begin
  select decrypted_secret into endpoint
    from vault.decrypted_secrets where name = 'push_function_url';

  select decrypted_secret into secret
    from vault.decrypted_secrets where name = 'push_hook_secret';

  if endpoint is null or secret is null then
    return;
  end if;

  -- The payload names a person and a conversation and never a word anybody
  -- wrote. 0019 requires that: the same comment explains that a token proves
  -- possession of a device, and if that is ever wrong the consequence must be
  -- a misrouted notification rather than a leaked message.
  perform net.http_post(
    url     := endpoint,
    body    := jsonb_build_object('recipient', recipient, 'kind', kind, 'match_id', thread),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Secret', secret
    )
  );
exception
  when others then
    -- Same reasoning as the missing secret above, for the case where pg_net
    -- itself is unhappy.
    return;
end;
$$;

revoke all on function public.queue_push(uuid, text, uuid) from public;

-- ---------------------------------------------------------------- a message
--
-- after insert, so the text safety trigger in 0027 has already had its say and
-- a refused message notifies nobody.

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  select case when m.user_a = new.sender_id then m.user_b else m.user_a end
    into other
    from matches m
   where m.id = new.match_id
     and m.unmatched_by is null;

  if other is null then
    return new;
  end if;

  if exists (
    select 1 from blocks
     where (blocker_id, blocked_id) in ((other, new.sender_id), (new.sender_id, other))
  ) then
    return new;
  end if;

  -- They removed this conversation, so list_threads does not return it and the
  -- notification would open a screen they cannot find again.
  if exists (
    select 1 from hidden_matches where match_id = new.match_id and user_id = other
  ) then
    return new;
  end if;

  perform public.queue_push(other, 'message', new.match_id);

  return new;
end;
$$;

create trigger messages_notify
  after insert on messages
  for each row
  execute function public.notify_new_message();

-- ------------------------------------------------------------------ a match
-- Both sides. A match is the one unambiguously good thing that happens here.

create or replace function public.notify_new_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.queue_push(new.user_a, 'match', new.id);
  perform public.queue_push(new.user_b, 'match', new.id);

  return new;
end;
$$;

create trigger matches_notify
  after insert on matches
  for each row
  execute function public.notify_new_match();

-- ------------------------------------------------------------------ realtime
--
-- For the browser, which has no Expo token and no push service. hooks/
-- use-push.web.ts subscribes to these two tables and raises a Notification
-- itself, so a table missing from the publication is a browser that silently
-- never notifies. messages was added in 0013; matches never was.
--
-- Safe by the rule in 0013: a delete reaches every subscriber because RLS
-- cannot be applied to a row that is gone. Nothing deletes a match. Unmatching
-- sets unmatched_by and account deletion is anonymisation, so the row survives
-- both.

alter publication supabase_realtime add table matches;
