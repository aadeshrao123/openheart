-- OpenHeart :: discovery benchmark seed
--
-- LOCAL BENCHMARKING ONLY. This truncates every user table and refills it with
-- synthetic profiles and swipes: 100k and roughly 5M by default, or whatever
-- -v scale=N asks for. Never point it at a database that holds real accounts.
--
-- It exists so the question "when does discover_profiles need work" is answered
-- with a measured number instead of an opinion. See README.md in this directory
-- for how to load it and how to record a result.

-- Scale. Defaults to the 100k the first baseline was taken at, so a plain
-- psql -f run is unchanged. Pass -v scale=1000000 to answer whether the timings
-- stay linear, which is a different question from whether they are acceptable.
-- The swipe distribution is per profile, so the swipe count scales with it.
\if :{?scale}
\else
  \set scale 100000
\endif

begin;

-- 5M rows will not finish inside whatever statement_timeout the connecting role
-- carries, and Supabase sets one per role.
set local statement_timeout = 0;

-- ------------------------------------------------------------------- guard
--
-- Every row written below carries the beefcafe id prefix, so anything else in
-- profiles came from a real signup. Stop rather than truncate it.
--
-- The blind spot is a production database whose profiles table happens to be
-- empty: nothing inside SQL distinguishes that from a fresh local one. README
-- covers what to check by eye first.

do $$
declare
  foreign_profiles bigint;
begin
  select count(*)
    into foreign_profiles
    from profiles
   where id::text not like 'beefcafe-0000-4000-8000-%';

  if foreign_profiles > 0 then
    raise exception
      'refusing to seed: profiles holds % row(s) this script did not create',
      foreign_profiles
      using hint = 'This looks like a real database. Benchmark against a local one.';
  end if;
end;
$$;

-- Re-runnable: the guard above already proved nothing here is real. CASCADE
-- reaches photos, swipes, matches, messages, reports, blocks and hidden_matches,
-- all of which reference profiles.
truncate table profiles cascade;

-- The discovery query never reads matches, and leaving this on would run a
-- plpgsql function with a reciprocal lookup once per swipe, 5M times, which
-- would dominate the load and measure nothing anyone asked about.
alter table swipes disable trigger swipes_create_match;

-- ---------------------------------------------------------------- profiles
--
-- The birthdate and location triggers stay enabled on purpose. Coarsening to
-- two decimal places is what production data looks like, and it collapses
-- 100k points onto a roughly 1km grid, which is the distribution the GiST
-- index actually has to cope with.
--
-- random() is seeded so a reload produces the same city twice. The sequence is
-- stable for a given seed within a Postgres build, not across major upgrades,
-- so treat a version change as a reason to re-baseline rather than compare.

select setseed(0.4242);

with params as (
  select
    51.5074::float8 as centre_lat,
    -0.1278::float8 as centre_lon,
    -- 25km radius is a 50km-wide metro, which is the scale one city launch
    -- actually covers.
    25.0::float8    as radius_km
),
scatter as (
  select
    series.n                                      as n,
    params.centre_lat                             as centre_lat,
    params.centre_lon                             as centre_lon,
    2 * pi() * random()                           as bearing,
    -- 0.5 spreads points evenly over the disc. 0.6 leans them toward the
    -- centre, so a small ST_DWithin radius is more selective than a large one,
    -- which is how a real metro behaves. Lowering it flattens that back out.
    params.radius_km * power(random(), 0.6)       as offset_km,
    random()                                      as active_roll,
    30 + random() * 335                           as signup_days_ago
  from params
  cross join generate_series(0, :scale - 1) as series(n)
)
insert into profiles (
  id,
  display_name,
  birthdate,
  bio,
  gender,
  seeking,
  location,
  max_distance_km,
  age_min,
  age_max,
  is_active,
  photo_verified,
  last_active,
  created_at
)
select
  ('beefcafe-0000-4000-8000-' || lpad(to_hex(scatter.n), 12, '0'))::uuid,
  'Bench ' || scatter.n,
  (
    current_date
    - interval '18 years'
    -- n::bigint because generate_series yields integer and n * 7919 passes
    -- int4 at a scale of 1000000. The value is identical at 100000, so the
    -- earlier baseline is still comparable.
    - (((scatter.n::bigint * 7919) % 15340) + 1) * interval '1 day'
  )::date,
  -- Bio length drives row width, which drives heap pages read per candidate.
  repeat('Benchmark filler text. ', 4 + (scatter.n % 6)),
  case scatter.n % 3
    when 0 then 'woman'
    when 1 then 'man'
    else 'nonbinary'
  end,
  case scatter.n % 3
    when 0 then array['man']
    when 1 then array['woman']
    else array['woman', 'man', 'nonbinary']
  end,
  ST_SetSRID(
    ST_MakePoint(
      scatter.centre_lon
        + (scatter.offset_km / (111.0 * cos(radians(scatter.centre_lat))))
          * cos(scatter.bearing),
      scatter.centre_lat + (scatter.offset_km / 111.0) * sin(scatter.bearing)
    ),
    4326
  )::geography,
  10 + (scatter.n % 41) * 2,
  18 + (scatter.n % 12),
  18 + (scatter.n % 12) + 15 + (scatter.n % 20),
  true,
  true,
  now() - scatter.active_roll * interval '30 days',
  now() - scatter.signup_days_ago * interval '1 day'
from scatter;

-- ------------------------------------------------------------------ swipes
--
-- Deliberately skewed. Most people swipe a few dozen times, a small minority
-- swipe thousands, and it is that minority whose anti-join against swipes is
-- the expensive case. A flat 50 per user would benchmark a user who does not
-- exist.
--
-- Target index is (7n + 811j) mod scale. 811 is prime and divides neither
-- 100000 nor 1000000, so gcd is 1 and j maps to distinct targets for every j
-- below scale: no swiper can draw the same target twice. Change 811, or pick a
-- scale that is a multiple of it, and that guarantee goes with it.

insert into swipes (swiper_id, target_id, direction, created_at)
select
  ('beefcafe-0000-4000-8000-' || lpad(to_hex(swiper.n), 12, '0'))::uuid,
  ('beefcafe-0000-4000-8000-'
    || lpad(to_hex((swiper.n * 7 + step.j * 811) % :scale), 12, '0'))::uuid,
  (case when (swiper.n + step.j) % 10 < 3 then 'like' else 'pass' end)
    ::swipe_direction,
  now() - (step.j % 90) * interval '1 day'
from generate_series(0, :scale - 1) as swiper(n)
cross join lateral generate_series(
  1,
  case when swiper.n % 100 = 0 then 1500 else 15 + (swiper.n % 41) end
) as step(j)
where (swiper.n * 7 + step.j * 811) % :scale <> swiper.n;

alter table swipes enable trigger swipes_create_match;

commit;

-- Column statistics, not row counts, are what the age range and the anti-join
-- against swipes need to plan sensibly, and a freshly loaded table has none.
-- Autovacuum gets there on its own schedule, which is not before your EXPLAIN.
-- Skipping this is the most common way to get a number that means nothing.
analyze profiles;
analyze swipes;

do $$
declare
  profile_count bigint;
  swipe_count   bigint;
begin
  select count(*) into profile_count from profiles;
  select count(*) into swipe_count   from swipes;

  raise notice 'seeded % profiles and % swipes', profile_count, swipe_count;
  raise notice 'heavy swiper: beefcafe-0000-4000-8000-000000000000';
  raise notice 'light swiper: beefcafe-0000-4000-8000-000000000001';
end;
$$;
