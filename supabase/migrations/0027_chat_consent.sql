-- OpenHeart :: explicit language in one conversation, by agreement
--
-- 0025 refused explicit words in written profile text and deliberately left
-- messages alone, on the reasoning that two people who have matched are having
-- a private conversation. That is right about the conversation and wrong about
-- how it starts. The first explicit message is not a conversation, it is
-- something one person does to another, and it is the most common complaint
-- women have about this category of app.
--
-- So the default flips: explicit language is refused in messages too, and the
-- two people can agree to turn it off between them.
--
-- The shape of that agreement is the whole design.
--
--   Both, not either. One person disabling their own filter to receive is
--   coherent but nobody predicts it correctly, and a safety control whose
--   direction people get backwards is not one.
--
--   Revocable alone, immediately. Consent that cannot be withdrawn is not
--   consent. Either side ends it without the other agreeing.
--
--   Only the sexual category. Slurs stay refused with or without an agreement,
--   because abuse is abuse and nobody consented to that. Contact details and
--   solicitation are untouched here, exactly as 0025 left them: swapping
--   numbers after matching is ordinary, and it is unrelated to this.
--
--   Whoever said no owns when it is asked again. After a decline or a
--   revocation only that person can open a new request. A cooldown would just
--   time-box the nagging; this removes it, and it is one condition rather than
--   a clock.

create type consent_state as enum ('requested', 'active', 'declined', 'revoked');

-- One row per match, updated in place. No history: what is worth keeping is
-- what is true now, and a log of who asked for what and when is a thing that
-- gets subpoenaed or breached rather than a thing that helps anybody.
create table explicit_consent (
  match_id     uuid primary key references matches(id) on delete cascade,
  state        consent_state not null,

  -- Who asked, and who answered. settled_by is the person a decline or a
  -- revocation belongs to, which is what decides who may re-open it.
  requested_by uuid not null references profiles(id) on delete cascade,
  settled_by   uuid references profiles(id) on delete cascade,

  updated_at   timestamptz not null default now()
);

alter table explicit_consent enable row level security;

-- Read only, and only your own conversations. Every write goes through the
-- three functions below: a client that could update this row could grant itself
-- the other person's agreement, which is the only thing this table holds.
create policy explicit_consent_select on explicit_consent
  for select to authenticated
  using (public.is_match_member(match_id));

grant select on explicit_consent to authenticated;

-- ------------------------------------------------------------- the predicate

create or replace function public.explicit_allowed(m uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from explicit_consent where match_id = m and state = 'active'
  );
$$;

-- security definer means this reads past RLS, and a new function is executable
-- by public by default. Left alone it answers "have those two agreed" for any
-- match id, to anybody. The trigger below is the only caller and reaches it as
-- the owner, so nothing needs the grant.
revoke all on function public.explicit_allowed(uuid) from public;

-- ------------------------------------------------------------ enforcement
--
-- The half that holds. lib/text-safety.ts refuses the same text in the app so
-- nobody has to round-trip to find out, but that copy is advice: it runs on a
-- device somebody else owns and can edit out.

-- security definer so it can reach explicit_allowed above, which nobody else
-- holds a grant on. It only ever reads.
create or replace function public.reject_unsafe_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  category text := public.text_safety_violation(new.body);
begin
  -- Unrelated to this feature and unchanged by it.
  if category is null or category in ('contact', 'solicitation') then
    return new;
  end if;

  if category = 'sexual' and public.explicit_allowed(new.match_id) then
    return new;
  end if;

  raise exception 'unsafe_text:body:%', category using errcode = '22000';
end;
$$;

create trigger messages_text_safety
  before insert on messages
  for each row
  execute function public.reject_unsafe_message();

-- ------------------------------------------------------------- the agreement

create or replace function request_explicit_consent(thread uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := (select auth.uid());
  existing explicit_consent;
begin
  if not public.is_match_member(thread)
     or public.is_match_blocked(thread)
     or not exists (select 1 from matches where id = thread and unmatched_by is null) then
    raise exception 'not an open conversation' using errcode = '42501';
  end if;

  select * into existing from explicit_consent where match_id = thread;

  if existing.match_id is null then
    insert into explicit_consent (match_id, state, requested_by)
    values (thread, 'requested', me);
    return;
  end if;

  -- Already asked, or already agreed. Asking again is a no-op rather than an
  -- error: two people tapping at once is not a mistake either of them made.
  if existing.state in ('requested', 'active') then
    return;
  end if;

  -- The rule that stops this becoming a way to wear somebody down. They said
  -- no; they decide if it comes back. A null settled_by means nobody refused
  -- anything, which is what withdrawing your own unanswered request leaves
  -- behind, and then either of you may ask.
  if existing.settled_by is not null and existing.settled_by <> me then
    raise exception 'the other person ended this and only they can reopen it'
      using errcode = '42501';
  end if;

  update explicit_consent
     set state = 'requested', requested_by = me, settled_by = null, updated_at = now()
   where match_id = thread;
end;
$$;

create or replace function respond_to_explicit_consent(thread uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := (select auth.uid());
  existing explicit_consent;
begin
  if not public.is_match_member(thread) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select * into existing from explicit_consent where match_id = thread;

  if existing.match_id is null or existing.state <> 'requested' then
    raise exception 'nothing to answer' using errcode = '42704';
  end if;

  -- Agreeing with yourself is the one thing this must never allow, and it is
  -- the entire feature if it does.
  if existing.requested_by = me then
    raise exception 'you cannot answer your own request' using errcode = '42501';
  end if;

  update explicit_consent
     set state      = (case when accept then 'active' else 'declined' end)::consent_state,
         settled_by = me,
         updated_at = now()
   where match_id = thread;
end;
$$;

-- Alone, and at once. No confirmation from the other side, because needing
-- their agreement to stop is the thing that makes withdrawal impossible in
-- practice.
create or replace function revoke_explicit_consent(thread uuid)
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

  -- Taking back your own unanswered question is a cancellation, not a refusal.
  -- Recording it as a refusal would lock out the person who never got to
  -- answer, which is the opposite of what the rule is for.
  update explicit_consent
     set state      = 'revoked',
         settled_by = case
                        when state = 'requested' and requested_by = me then null
                        else me
                      end,
         updated_at = now()
   where match_id = thread
     and state in ('requested', 'active');
end;
$$;

revoke all on function request_explicit_consent(uuid) from public;
revoke all on function respond_to_explicit_consent(uuid, boolean) from public;
revoke all on function revoke_explicit_consent(uuid) from public;

grant execute on function request_explicit_consent(uuid) to authenticated;
grant execute on function respond_to_explicit_consent(uuid, boolean) to authenticated;
grant execute on function revoke_explicit_consent(uuid) to authenticated;

-- ------------------------------------------------------------------ realtime
--
-- So a request reaches the other person while they are looking at the chat
-- rather than the next time they open it. Nothing here is ever deleted, which
-- matters for the reason given in 0013: RLS is not applied to DELETE events, so
-- a delete would reach every subscriber of the table. Every transition above is
-- an update.

alter publication supabase_realtime add table explicit_consent;
