-- OpenHeart :: telling everybody something
--
-- Two jobs, and the second is the reason this exists now rather than later.
--
-- An announcement: a new feature, a planned outage, something every account
-- needs to know. There is no other way to reach people who are not currently
-- looking at the app.
--
-- And a test. Proving push works has meant creating a match or inserting a
-- message, which needs two accounts, a conversation, and cleaning up
-- afterwards. One line that reaches every registered device is a better tool,
-- and it exercises the identical path: same trigger function, same secret, same
-- Edge Function, same Expo call.
--
-- Nobody but a maintainer may call it. Not a user, not a moderator. It is
-- security definer with no grant, so the SQL editor is the only door.

-- Text on the payload, which the match and message paths deliberately never
-- carry. Those describe something the recipient can already read in the app, so
-- the notification only has to say a thing happened. An announcement has no
-- other home: the words are the whole content, and there is nowhere else to
-- read them.
-- Dropped rather than left alongside. Adding defaulted arguments creates a
-- second function rather than replacing the first, and a three argument call
-- then matches both: "function queue_push(uuid, unknown, uuid) is not unique",
-- raised from inside the trigger, which fails the message rather than the
-- notification. PL/pgSQL resolves the name at run time, so the triggers pick up
-- the new one without being touched.
drop function if exists public.queue_push(uuid, text, uuid);

create or replace function public.queue_push(
  recipient uuid,
  kind      text,
  thread    uuid,
  title     text default null,
  body      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  endpoint text;
  secret   text;
  anon     text;
begin
  select decrypted_secret into endpoint
    from vault.decrypted_secrets where name = 'push_function_url';

  select decrypted_secret into secret
    from vault.decrypted_secrets where name = 'push_hook_secret';

  select decrypted_secret into anon
    from vault.decrypted_secrets where name = 'push_function_anon_key';

  if endpoint is null or secret is null or anon is null then
    return;
  end if;

  perform net.http_post(
    url  := endpoint,
    body := jsonb_strip_nulls(jsonb_build_object(
      'recipient', recipient,
      'kind',      kind,
      'match_id',  thread,
      'title',     title,
      'body',      body
    )),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || anon,
      'X-Push-Secret', secret
    )
  );
exception
  when others then
    return;
end;
$$;

revoke all on function public.queue_push(uuid, text, uuid, text, text) from public;

-- ------------------------------------------------------------------ sending
--
-- One notification per person, not per device: somebody signed in on a phone
-- and a tablet is one person being told one thing, and the Edge Function
-- already fans out across every token that person owns.
--
-- Deliberately not translated. Every other string in the product is, and this
-- one cannot be: the words arrive as an argument rather than from a table, so
-- there is nothing to look up. Whoever writes the announcement chooses the
-- language, and for a launch in one city that is a real answer rather than a
-- shortcut. It stops being one the day the second city is in a different
-- language.

create or replace function broadcast_push(title text, body text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  reached int := 0;
  person  uuid;
begin
  if title is null or btrim(title) = '' or body is null or btrim(body) = '' then
    raise exception 'an announcement needs a title and a body'
      using errcode = '22023';
  end if;

  for person in
    select distinct t.profile_id
      from push_tokens t
      join profiles p on p.id = t.profile_id
     -- A deleted or suspended account keeps its row and must not be addressed
     -- as though it were still a user.
     where p.deleted_at is null
       and p.suspended_at is null
  loop
    perform public.queue_push(person, 'announcement', null, title, body);

    reached := reached + 1;
  end loop;

  return reached;
end;
$$;

revoke all on function broadcast_push(text, text) from public;
