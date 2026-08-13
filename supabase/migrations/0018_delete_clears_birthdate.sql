-- OpenHeart :: deletion erases the date of birth
--
-- Confirmed by running it: a deleted profile kept its exact birthdate next to a
-- retained id while every other personal field was cleared.
--
-- The same check confirmed suspended_at and suspended_reason already survive a
-- self-deletion, and account_lifecycle.test.sql already asserted it, so nothing
-- here touches them.
--
-- Deletion stays available to a suspended account. App Store guideline
-- 5.1.1(v) requires an in-app route to it, and blocking one would not stop ban
-- evasion anyway: that needs an identity signal outliving the account.

-- The shape 0007 gave display_name. A live profile still cannot be missing a
-- birthdate, so the age gate keeps the column it depends on.
alter table profiles
  alter column birthdate drop not null;

alter table profiles
  add constraint birthdate_valid check (
    case
      when deleted_at is null then birthdate is not null
      else birthdate is null
    end
  );

-- enforce_adult() needs no change: `null > date` is null rather than true, so
-- the guard does not fire.

update profiles
   set birthdate = null
 where deleted_at is not null
   and birthdate is not null;

-- ---------------------------------------------------- immutable, with one exit
--
-- 0004 meant it, so the trigger rejected the erasure too and the update above
-- failed until this changed. Downward only: letting null become a date would
-- hand a tombstone a fresh birthdate.
--
-- No client can reach it. 0006 grants update on neither birthdate nor
-- deleted_at.

create or replace function enforce_birthdate_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.birthdate is null and new.deleted_at is not null then
    return new;
  end if;

  if old.birthdate is distinct from new.birthdate then
    raise exception 'birthdate cannot be changed after signup';
  end if;

  return new;
end;
$$;

-- Replaced whole rather than patched: this function is read as the complete
-- list of what leaving erases.

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

  insert into deleted_media (r2_key)
  select r2_key
    from photos
   where profile_id = me
  on conflict (r2_key) do nothing;

  delete from photos where profile_id = me;

  -- The thread stays: the other person keeps their history and removes it on
  -- their own terms via hidden_matches.
  update matches
     set unmatched_by = me
   where unmatched_by is null
     and me in (user_a, user_b);

  update profiles
     set display_name   = '',
         bio            = null,
         gender         = null,
         seeking        = '{}',
         location       = null,
         birthdate      = null,
         is_active      = false,
         photo_verified = false,
         deleted_at     = now()
   where id = me;

  -- suspended_at and suspended_reason are absent from that list on purpose.
  -- Leaving must not clear a moderation record.

  delete from auth.users where id = me;
end;
$$;

revoke all on function delete_my_account() from public;
grant execute on function delete_my_account() to authenticated;
