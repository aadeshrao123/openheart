-- OpenHeart :: chat
--
-- Realtime is Postgres Changes, which re-uses the RLS policies already in
-- place: the server assumes each subscriber's identity and only forwards rows
-- that subscriber could select. Broadcast would put message bodies in
-- realtime.messages, whose documented policy is `using (true)`.
-- https://supabase.com/docs/guides/realtime/postgres-changes
--
-- That doc also states RLS is NOT applied to DELETE events, since Postgres
-- cannot check access on a row that is gone. A delete therefore reaches every
-- subscriber of the table. Nothing in chat is ever deleted because of it:
-- unsending is an update, and clearing a reaction is an update to null.

-- ---------------------------------------------------------------- messages

alter table messages
  add column delivered_at timestamptz,
  add column deleted_at   timestamptz;

-- Widened, not narrowed: an unsent message keeps its row and loses its body.
alter table messages drop constraint messages_body_check;

alter table messages
  add constraint messages_body_check check (
    char_length(body) <= 2000
    and (deleted_at is not null or char_length(body) >= 1)
  );

create index messages_unread_idx
  on messages (match_id, sender_id)
  where read_at is null;

create index messages_sender_recent_idx on messages (sender_id, created_at desc);

-- --------------------------------------------------------------- reactions
--
-- One reaction per person per message, so the row is a slot and clearing it is
-- an update. The column holds a code rather than the emoji: the glyph is
-- presentation, and a stored one could never be changed without rewriting
-- every row.

create table message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  reaction   text,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint reaction_known check (
    reaction is null
    or reaction in ('love', 'laugh', 'wow', 'sad', 'fire', 'thumbs_up')
  )
);

alter table message_reactions enable row level security;

create or replace function public.is_message_participant(m uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from messages msg
      join matches mt on mt.id = msg.match_id
     where msg.id = m
       and (select auth.uid()) in (mt.user_a, mt.user_b)
  );
$$;

create or replace function public.is_open_message_participant(m uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from messages msg
      join matches mt on mt.id = msg.match_id
     where msg.id = m
       and (select auth.uid()) in (mt.user_a, mt.user_b)
       and mt.unmatched_by is null
  );
$$;

create policy message_reactions_select on message_reactions
  for select to authenticated
  using (public.is_message_participant(message_id));

create policy message_reactions_insert_own on message_reactions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_open_message_participant(message_id)
  );

create policy message_reactions_update_own on message_reactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.is_open_message_participant(message_id)
  );

-- No delete policy and no delete grant, per the note at the top of this file.

grant select on message_reactions to authenticated;
grant insert (message_id, user_id, reaction) on message_reactions to authenticated;
grant update (reaction) on message_reactions to authenticated;

-- security invoker, so both reaction policies still apply. It exists because
-- PostgREST's upsert writes every column in the payload back on conflict,
-- including the primary key, and only `reaction` is updatable.
--
-- An empty string clears, because the generated client types make a text
-- argument non-nullable and there is no way to pass null through them.
create or replace function set_reaction(message uuid, code text)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into message_reactions (message_id, user_id, reaction)
  values (message, (select auth.uid()), nullif(code, ''))
  on conflict (message_id, user_id)
    do update set reaction = excluded.reaction;
$$;

revoke all on function set_reaction(uuid, text) from public;
grant execute on function set_reaction(uuid, text) to authenticated;

-- ------------------------------------------------------- message mutations
--
-- Receipts and unsend are state transitions with rules attached, and a column
-- grant cannot express "only while unread" or "never backwards". Both the
-- grant and the policy are withdrawn so these functions are the only path.

drop policy messages_mark_read on messages;
revoke update on messages from authenticated;

create or replace function mark_thread_delivered(thread uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.is_match_member(thread) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  update messages
     set delivered_at = now()
   where match_id = thread
     and sender_id <> me
     and delivered_at is null;
end;
$$;

create or replace function mark_thread_read(thread uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.is_match_member(thread) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  update messages
     set delivered_at = coalesce(delivered_at, now()),
         read_at      = now()
   where match_id = thread
     and sender_id <> me
     and read_at is null;
end;
$$;

create or replace function unsend_message(message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target messages;
begin
  select * into target from messages where id = message;

  -- One error for "no such message" and for "not yours", so this cannot be
  -- used to probe whether an id exists.
  if target.id is null or target.sender_id <> (select auth.uid()) then
    raise exception 'message not found' using errcode = '42501';
  end if;

  if target.deleted_at is not null then
    return;
  end if;

  if target.read_at is not null then
    raise exception 'message has already been read'
      using errcode = '55000',
            hint = 'A message can only be unsent before it is read.';
  end if;

  update messages
     set body = '',
         deleted_at = now()
   where id = message;
end;
$$;

revoke all on function mark_thread_delivered(uuid) from public;
revoke all on function mark_thread_read(uuid) from public;
revoke all on function unsend_message(uuid) from public;

grant execute on function mark_thread_delivered(uuid) to authenticated;
grant execute on function mark_thread_read(uuid) to authenticated;
grant execute on function unsend_message(uuid) to authenticated;

-- ------------------------------------------------------------- rate limit
-- The second half of the swipes-and-messages non-negotiable. Same shape and
-- same SQLSTATE as 0012, so the client has one branch for both.

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_messages int;
  hourly_limit constant int := 300;
begin
  select count(*) into recent_messages
    from messages
   where sender_id = new.sender_id
     and created_at > now() - interval '1 hour';

  if recent_messages >= hourly_limit then
    raise exception 'message rate limit exceeded'
      using errcode = '53400',
            hint = 'Wait a while before sending more messages.';
  end if;

  return new;
end;
$$;

create trigger messages_rate_limit
  before insert on messages
  for each row execute function public.enforce_message_rate_limit();

-- ------------------------------------------------------------ thread list
-- security invoker, so every row is still filtered by the policies on
-- matches, profiles, messages and photos.

create or replace function list_threads()
returns table (
  match_id        uuid,
  other_id        uuid,
  other_name      text,
  other_photo_key text,
  other_deleted   boolean,
  last_body       text,
  last_at         timestamptz,
  last_sender_id  uuid,
  last_deleted    boolean,
  unread_count    int,
  unmatched       boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (select (select auth.uid()) as id)
  select
    m.id,
    other.id,
    other.display_name,
    (
      select p.r2_key
        from photos p
       where p.profile_id = other.id
         and p.moderation_state = 'approved'
       order by p.position
       limit 1
    ),
    other.deleted_at is not null,
    last.body,
    last.created_at,
    last.sender_id,
    last.deleted_at is not null,
    (
      select count(*)
        from messages u
       where u.match_id = m.id
         and u.sender_id <> me.id
         and u.read_at is null
         and u.deleted_at is null
    )::int,
    m.unmatched_by is not null
  from matches m
  join me on me.id in (m.user_a, m.user_b)
  join profiles other
    on other.id = case when m.user_a = me.id then m.user_b else m.user_a end
  left join lateral (
    select body, created_at, sender_id, deleted_at
      from messages
     where match_id = m.id
     order by created_at desc
     limit 1
  ) last on true
  where not exists (
    select 1
      from hidden_matches h
     where h.match_id = m.id
       and h.user_id = me.id
  )
  -- A new match has no messages yet and still belongs at the top.
  order by coalesce(last.created_at, m.created_at) desc;
$$;

revoke all on function list_threads() from public;
grant execute on function list_threads() to authenticated;

-- --------------------------------------------------------------- realtime
-- Without this the tables emit no WAL for the realtime server and every
-- subscription silently receives nothing.

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table message_reactions;
