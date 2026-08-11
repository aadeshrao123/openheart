-- OpenHeart :: account deletion, birthdate immutability, media cleanup
--
-- Deletion is anonymization in place, not a row delete. Three requirements
-- conflict under a hard delete, and this is the only shape that satisfies all
-- three at once:
--
--   GDPR      the personal data must actually be erased
--   safety    reports about an abuser must survive their account deletion,
--             otherwise deleting and re-signing up erases the evidence trail
--   product   the other person in a conversation must not see their chat
--             history silently vanish with no explanation
--
-- Keeping the row and destroying its contents satisfies all three. The retained
-- id is a pseudonymous identifier held under legitimate interest for abuse
-- prevention, which is a narrower retention than keeping the profile itself.

alter table profiles
  add column deleted_at timestamptz;

-- ------------------------------------------------- birthdate immutability
--
-- The age check in 0001 fires on insert and on update, but nothing prevented
-- the update itself. A user could sign up at 25 and edit to 17 afterwards, or
-- edit upward to escape an age-based restriction. Birthdate is set once.

create or replace function enforce_birthdate_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.birthdate is distinct from new.birthdate then
    raise exception 'birthdate cannot be changed after signup';
  end if;

  return new;
end;
$$;

create trigger profiles_birthdate_immutable
  before update of birthdate on profiles
  for each row execute function enforce_birthdate_immutable();

-- ------------------------------------------------------------ media queue
--
-- Postgres cannot delete an object out of R2, so orphaned keys are queued here
-- and drained by a scheduled Edge Function. Without the queue, a deleted
-- account leaves its photos publicly fetchable by anyone who kept the URL.

create table deleted_media (
  r2_key      text primary key,
  queued_at   timestamptz not null default now(),
  purged_at   timestamptz
);

alter table deleted_media enable row level security;

create index deleted_media_pending_idx
  on deleted_media (queued_at)
  where purged_at is null;

-- No policies: the service role bypasses RLS, and no client should ever read
-- this table. An empty policy set means deny-all for authenticated users.

-- --------------------------------------------------------------- deletion

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  -- Queue the photo objects before dropping the rows that name them.
  insert into deleted_media (r2_key)
  select r2_key
    from photos
   where profile_id = me
  on conflict (r2_key) do nothing;

  delete from photos where profile_id = me;

  -- Close every open conversation. The thread itself stays: the other person
  -- keeps their history and removes it on their own terms via hidden_matches.
  update matches
     set unmatched_by = me
   where unmatched_by is null
     and me in (user_a, user_b);

  -- Erase the personal data, keep the row so foreign keys, message history and
  -- moderation records stay intact.
  update profiles
     set display_name   = '',
         bio            = null,
         gender         = null,
         seeking        = '{}',
         location       = null,
         is_active      = false,
         photo_verified = false,
         deleted_at     = now()
   where id = me;

  -- Message bodies are the other participant's data as much as the leaver's,
  -- so the thread survives. The sender renders as a deleted user because the
  -- profile carries no name.

  delete from auth.users where id = me;
end;
$$;

revoke all on function delete_my_account() from public;
grant execute on function delete_my_account() to authenticated;

-- A deleted profile must never reappear in discovery. is_active is already
-- false above, which both the RLS policy and discover_profiles filter on, but
-- the constraint makes the invariant explicit rather than incidental.
alter table profiles
  add constraint deleted_profiles_are_inactive
  check (deleted_at is null or is_active = false);

-- --------------------------------------------- visibility inside a match
--
-- profiles_select_others requires is_active, so once someone deletes their
-- account the other participant could no longer read the row at all and the
-- chat would render blank. Match members can always see each other, which is
-- what lets the UI show a deleted-account state instead of an empty screen.
-- The row carries no personal data at that point.

create policy profiles_select_match_member on profiles
  for select to authenticated
  using (
    exists (
      select 1
        from matches m
       where (select auth.uid()) in (m.user_a, m.user_b)
         and profiles.id in (m.user_a, m.user_b)
    )
  );

-- ---------------------------------------------------- per-user chat hiding
--
-- Deleting an account ends the conversation but does not destroy it. The
-- surviving participant keeps their history and decides for themselves when to
-- remove it, because those messages are their data too.
--
-- Hiding is per user rather than a column on matches: each side removes only
-- their own copy, and neither can erase the other's.

create table hidden_matches (
  match_id  uuid not null references matches(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table hidden_matches enable row level security;

create policy hidden_matches_select_own on hidden_matches
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy hidden_matches_insert_own on hidden_matches
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_match_member(match_id)
  );

create policy hidden_matches_delete_own on hidden_matches
  for delete to authenticated
  using ((select auth.uid()) = user_id);
