-- OpenHeart :: discovery authorization tests
--
-- discover_profiles is security definer (see 0008), so Row Level Security does
-- not filter its results. Every exclusion it performs is an ordinary predicate
-- in the function body, and nothing but these tests would catch one being
-- dropped.
--
-- Any change to discover_profiles adds a case here first.

begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email)
select
  ('cccc0000-0000-4000-8000-00000000000' || n)::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'u' || n || '@test.dev'
from generate_series(1, 7) as n;

-- All within a few hundred metres of each other so distance never excludes.
insert into profiles (
  id, display_name, birthdate, location, photo_verified, is_active, max_distance_km
)
select
  ('cccc0000-0000-4000-8000-00000000000' || n)::uuid,
  'User ' || n,
  '1995-01-01'::date,
  ST_SetSRID(ST_MakePoint(-0.12, 51.50), 4326)::geography,
  true, true, 50
from generate_series(1, 7) as n;

-- 1 is the caller. Set up one disqualifying condition per other profile.
update profiles set photo_verified = false
 where id = 'cccc0000-0000-4000-8000-000000000003';

update profiles set is_active = false
 where id = 'cccc0000-0000-4000-8000-000000000004';

insert into swipes (swiper_id, target_id, direction)
values ('cccc0000-0000-4000-8000-000000000001',
        'cccc0000-0000-4000-8000-000000000005', 'pass');

-- 6 blocked the caller. 7 was blocked by the caller. Both directions must hide.
insert into blocks (blocker_id, blocked_id) values
  ('cccc0000-0000-4000-8000-000000000006', 'cccc0000-0000-4000-8000-000000000001'),
  ('cccc0000-0000-4000-8000-000000000001', 'cccc0000-0000-4000-8000-000000000007');

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "cccc0000-0000-4000-8000-000000000001",
  "role": "authenticated"
}';

select is(
  (select count(*) from discover_profiles(50))::int, 1,
  'only the one eligible profile is returned'
);

select is(
  (select id from discover_profiles(50)),
  'cccc0000-0000-4000-8000-000000000002'::uuid,
  'and it is the right one'
);

select is(
  (select count(*) from discover_profiles(50)
    where id = 'cccc0000-0000-4000-8000-000000000006')::int, 0,
  'a user who blocked you never appears in your deck'
);

select is(
  (select count(*) from discover_profiles(50)
    where id = 'cccc0000-0000-4000-8000-000000000007')::int, 0,
  'a user you blocked never appears in your deck'
);

select is(
  (select count(*) from discover_profiles(50)
    where id = 'cccc0000-0000-4000-8000-000000000003')::int, 0,
  'an unverified profile never appears, which is the anti-bot gate'
);

-- A deleted account must not resurface in discovery. delete_my_account sets
-- is_active false and deleted_at, and both are checked independently.
reset role;
update profiles
   set is_active = false, display_name = '', birthdate = null, deleted_at = now()
 where id = 'cccc0000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "cccc0000-0000-4000-8000-000000000001",
  "role": "authenticated"
}';

select is(
  (select count(*) from discover_profiles(50))::int, 0,
  'a deleted account is gone from discovery'
);

-- anon holds no execute privilege, so this is a permission error rather than
-- an empty result.
set local role anon;
select throws_ok(
  'select * from discover_profiles(10)',
  '42501',
  null,
  'an unauthenticated caller cannot execute discovery at all'
);

select * from finish();
rollback;
