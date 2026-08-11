-- OpenHeart :: development deck seed
--
-- Local only. See README.md in this directory. This sets photo_verified, which
-- no client role can set and which the service role is tested as unable to set.
--
-- It only ever inserts its own rows. There is no blanket update of
-- photo_verified anywhere in here, because a seed that can promote a real
-- account is a seed that eventually will.

\set ON_ERROR_STOP on

\if :{?lat} \else \set lat 51.5074 \endif
\if :{?lon} \else \set lon -0.1278 \endif
\if :{?count} \else \set count 25 \endif

begin;

-- Fails closed on a database holding anything real. The blind spot is the same
-- one the benchmark seed documents: an empty profiles table is indistinguishable
-- from production inside SQL, so check the connection string by eye too.
do $$
declare
  real_profiles int;
begin
  select count(*) into real_profiles
    from profiles
   where id::text not like 'deadbeef-%';

  if real_profiles > 5 then
    raise exception
      'Refusing to seed: % profiles are not seed rows. This is not a scratch database.',
      real_profiles;
  end if;
end;
$$;

delete from profiles  where id::text like 'deadbeef-%';
delete from auth.users where id::text like 'deadbeef-%';

-- setseed makes the scatter reproducible on the same Postgres build, so a deck
-- that looked wrong can be looked at again.
select setseed(0.1975);

create temporary table seed_input on commit drop as
select
  n,
  ('deadbeef-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid as id
from generate_series(1, :count) as n;

-- Every column below is nullable in the schema and not nullable to GoTrue,
-- which scans each row into a struct with plain string fields. One null in one
-- seed row failed the entire admin user listing with a 500 from an endpoint
-- that never touched these accounts, which is what broke
-- scripts/grant-moderator.mjs. A user created through the API gets empty
-- strings here, so the seed matches that rather than leaving nulls.
insert into auth.users (
  id, instance_id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'deck' || n || '@dev.local',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '', '', '', '', '', '', '', ''
from seed_input;

insert into profiles (
  id, display_name, birthdate, bio, gender, seeking,
  location, max_distance_km, age_min, age_max,
  is_active, photo_verified, last_active
)
select
  s.id,
  'Test Profile ' || s.n,
  -- Ages 19 to 58, so an age filter has something to exclude either side.
  (current_date - make_interval(years => 19 + (s.n * 7) % 40, days => s.n * 3))::date,
  'Seeded profile ' || s.n || '. Not a real person.',
  (array['woman', 'man', 'nonbinary'])[1 + (s.n % 3)],
  array['woman', 'man', 'nonbinary'],
  -- Roughly within 8km. 0.05 degrees of latitude is about 5.5km, and the
  -- round_location trigger coarsens whatever lands here to ~1km anyway.
  ST_SetSRID(
    ST_MakePoint(
      (:lon) + (random() - 0.5) * 0.10,
      (:lat) + (random() - 0.5) * 0.10
    ),
    4326
  )::geography,
  50,
  18,
  99,
  true,
  -- The whole point of the seed. Nothing else in the system can write this.
  true,
  now() - make_interval(mins => s.n * 11)
from seed_input s;

commit;

select
  count(*) || ' seed profiles, ages ' ||
  min(extract(year from age(birthdate)))::int || ' to ' ||
  max(extract(year from age(birthdate)))::int as seeded
from profiles
where id::text like 'deadbeef-%';
