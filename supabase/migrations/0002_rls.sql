-- OpenHeart :: row level security
--
-- RLS is not one layer of the security model, it is the whole security model.
-- The client talks to Postgres directly, so these policies are the only thing
-- between a user and everyone else's data. A missing policy is a breach.
--
-- Two conventions applied throughout, both from Supabase's RLS performance
-- guidance. They are not micro-optimizations: without them, policy predicates
-- run once per scanned row.
--
--   1. auth.uid() is wrapped in a select so the planner evaluates it once as
--      an initPlan rather than per row.
--   2. every policy names its role with `to authenticated`, so it is skipped
--      entirely for anonymous requests instead of being evaluated and failed.
--
-- https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

alter table profiles enable row level security;
alter table photos   enable row level security;
alter table swipes   enable row level security;
alter table matches  enable row level security;
alter table messages enable row level security;
alter table reports  enable row level security;
alter table blocks   enable row level security;

-- ----------------------------------------------------------------- helpers
--
-- security definer so they can read blocks and matches from inside policies on
-- other tables without recursing into those tables' own policies.
--
-- search_path is pinned on every one of them. A security definer function with
-- a mutable search_path is a privilege escalation hole: a caller can create a
-- shadowing object in an earlier schema and have it execute as the definer.

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from blocks
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.is_match_member(m uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from matches
     where id = m
       and (select auth.uid()) in (user_a, user_b)
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'moderator')::boolean, false);
$$;

-- ---------------------------------------------------------------- profiles
--
-- Visible when it is your own row, or when the profile is active and neither
-- party has blocked the other.

create policy profiles_select_own on profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_select_others on profiles
  for select to authenticated
  using (
    is_active
    and not public.is_blocked((select auth.uid()), id)
  );

create policy profiles_insert_own on profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own on profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy profiles_delete_own on profiles
  for delete to authenticated
  using ((select auth.uid()) = id);

-- photo_verified is not client-writable. That is enforced by the column list in
-- the update grant in 0006, not here: REVOKE of a privilege the role never held
-- is a silent no-op and only looks like protection.

-- ------------------------------------------------------------------ photos
--
-- Approved photos inherit the visibility of their profile. Your own pending and
-- rejected photos stay visible to you so the UI can explain what happened.

create policy photos_select_own on photos
  for select to authenticated
  using ((select auth.uid()) = profile_id);

create policy photos_select_others on photos
  for select to authenticated
  using (
    moderation_state = 'approved'
    and not public.is_blocked((select auth.uid()), profile_id)
    and exists (
      select 1
        from profiles p
       where p.id = profile_id
         and p.is_active
    )
  );

create policy photos_insert_own on photos
  for insert to authenticated
  with check ((select auth.uid()) = profile_id);

create policy photos_delete_own on photos
  for delete to authenticated
  using ((select auth.uid()) = profile_id);

-- Moderation verdicts are not the client's to write. Enforced by the update
-- grant in 0006, which lists only `position`.

-- ------------------------------------------------------------------ swipes
--
-- The most sensitive table in the application. You can read the swipes you
-- made and nothing else, ever.
--
-- There is deliberately no policy exposing who liked you. That is the exact
-- data every paid dating app sells back to its users, and exposing it would
-- also let anyone enumerate interest across the user base.

create policy swipes_select_own on swipes
  for select to authenticated
  using ((select auth.uid()) = swiper_id);

create policy swipes_insert_own on swipes
  for insert to authenticated
  with check (
    (select auth.uid()) = swiper_id
    and not public.is_blocked((select auth.uid()), target_id)
  );

-- No update and no delete policy: a swipe is a historical fact.

-- ----------------------------------------------------------------- matches
--
-- Read-only to clients. Rows are created solely by the trigger in 0003, so two
-- simultaneous mutual likes cannot race into a duplicate or a missing match.

create policy matches_select_member on matches
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy matches_unmatch on matches
  for update to authenticated
  using ((select auth.uid()) in (user_a, user_b))
  with check (unmatched_by = (select auth.uid()));

-- ---------------------------------------------------------------- messages

create policy messages_select_member on messages
  for select to authenticated
  using (public.is_match_member(match_id));

create policy messages_insert_member on messages
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and public.is_match_member(match_id)
    and exists (
      select 1
        from matches
       where id = match_id
         and unmatched_by is null
    )
  );

-- Marking as read is the only permitted mutation, and only by the recipient.
create policy messages_mark_read on messages
  for update to authenticated
  using (
    public.is_match_member(match_id)
    and (select auth.uid()) <> sender_id
  )
  with check (
    public.is_match_member(match_id)
    and (select auth.uid()) <> sender_id
  );

-- ----------------------------------------------------------------- reports
--
-- Insert-only for users. A reporter must not learn whether their report was
-- actioned against a specific person, and a target must not learn that they
-- were reported at all.

create policy reports_insert_own on reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy reports_select_moderator on reports
  for select to authenticated
  using ((select public.is_moderator()));

create policy reports_update_moderator on reports
  for update to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

-- ------------------------------------------------------------------ blocks
--
-- You can see and manage the blocks you created. You can never see that someone
-- blocked you, which is what makes blocking safe rather than confrontational.

create policy blocks_select_own on blocks
  for select to authenticated
  using ((select auth.uid()) = blocker_id);

create policy blocks_insert_own on blocks
  for insert to authenticated
  with check ((select auth.uid()) = blocker_id);

create policy blocks_delete_own on blocks
  for delete to authenticated
  using ((select auth.uid()) = blocker_id);
