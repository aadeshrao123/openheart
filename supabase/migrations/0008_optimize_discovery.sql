-- OpenHeart :: make discovery scale with profile count
--
-- Measured at 100k profiles and 5M swipes: 0.5 to 1.1 seconds to return 20
-- rows, 404k shared buffer hits. See supabase/benchmark/RESULTS.md.
--
-- The swipes anti-join was not the problem. It resolved through swipes_pkey in
-- roughly a microsecond per candidate. The cost was Row Level Security on
-- profiles being evaluated once per candidate row.
--
-- Postgres ORs permissive policies together, so every candidate row paid for
-- all three policies on profiles, including profiles_select_match_member,
-- which runs an EXISTS against matches. That policy exists only so a match
-- participant can still see a deleted account in their chat. It is irrelevant
-- to discovery, but the planner cannot know that, so adding it in 0004 made
-- every profile read in the application more expensive.
--
-- Two changes here.
--
-- 1. discover_profiles becomes security definer, so the policies are not
--    re-evaluated per row, and the authorization it was relying on is now
--    written out explicitly in the function body.
-- 2. The age filter compares birthdate to a date range instead of computing
--    extract(year from age(birthdate)) per row, which is not sargable.
--
-- The tradeoff is real and must not be forgotten: RLS no longer protects the
-- rows this function returns. The block check, the active check and the
-- deleted check are now ordinary predicates that a careless edit could drop
-- without any policy catching it. supabase/tests/discovery.test.sql exists for
-- exactly that reason and must be extended alongside any change here.

drop function if exists discover_profiles(int);

create function discover_profiles(page_size int default 20)
returns table (
  id                 uuid,
  display_name       text,
  bio                text,
  gender             text,
  age                int,
  distance_bucket_km int,
  last_active        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select *
      from profiles
     where id = (select auth.uid())
       and deleted_at is null
  )
  select
    p.id,
    p.display_name,
    p.bio,
    p.gender,
    extract(year from age(p.birthdate))::int,
    -- Rounded to 5km. Precise distances from a few vantage points trilaterate
    -- to a home address.
    (round((ST_Distance(p.location, me.location) / 1000.0) / 5) * 5)::int,
    p.last_active
  from profiles p, me
  where p.id <> me.id

    -- Authorization. These four predicates were previously supplied by RLS and
    -- are now the only thing enforcing them. Do not remove one to make a query
    -- faster.
    and p.is_active
    and p.deleted_at is null
    and p.photo_verified
    and not exists (
      select 1
        from blocks b
       where (b.blocker_id = me.id and b.blocked_id = p.id)
          or (b.blocker_id = p.id and b.blocked_id = me.id)
    )

    -- Relevance.
    and ST_DWithin(p.location, me.location, me.max_distance_km * 1000)
    and p.birthdate <= (current_date - make_interval(years => me.age_min))
    and p.birthdate >  (current_date - make_interval(years => me.age_max + 1))
    and not exists (
      select 1
        from swipes s
       where s.swiper_id = me.id
         and s.target_id = p.id
    )
  order by p.last_active desc
  limit page_size;
$$;

-- security definer functions are executable by public by default, which would
-- let the anon role call this. auth.uid() is null for anon so the me CTE is
-- empty and it returns nothing, but relying on that is not a permission model.
revoke all on function discover_profiles(int) from public;
grant execute on function discover_profiles(int) to authenticated;

-- Supports the block anti-join in the reverse direction. blocks_blocked_idx
-- from 0001 covers blocked_id; the primary key covers blocker_id.
create index if not exists blocks_pair_idx on blocks (blocker_id, blocked_id);
