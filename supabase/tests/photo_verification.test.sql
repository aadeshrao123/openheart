-- OpenHeart :: photo verification tests
--   run with:  supabase test db
--
-- photo_verified is the anti-bot gate. A user who can set it, directly or by
-- writing their own attempt row, has defeated the whole model, so most of what
-- follows is about proving they cannot rather than proving verification works.

begin;
select plan(22);

-- fixtures -------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'ben@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'cleo@test.dev');

insert into profiles (id, display_name, birthdate) values
  ('11111111-1111-1111-1111-111111111111', 'Ana',  '1995-01-01'),
  ('22222222-2222-2222-2222-222222222222', 'Ben',  '1994-01-01'),
  ('33333333-3333-3333-3333-333333333333', 'Cleo', '1993-01-01');

insert into verification_attempts (id, profile_id, challenge, selfie_r2_key, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'turn_left', 'verification/ana-1', 'review'),
  ('aaaaaaaa-0000-4000-8000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'look_up', 'verification/ben-1', 'pending');

-- Ana, an ordinary user with an attempt under review ------------------------
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "11111111-1111-1111-1111-111111111111",
  "role": "authenticated"
}';

select is(
  (select count(*) from verification_attempts)::int, 1,
  'a user sees their own attempts and nobody else''s'
);

select throws_ok(
  $$ update profiles set photo_verified = true
      where id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  'a user cannot verify their own photos directly'
);

select throws_ok(
  $$ insert into verification_attempts (profile_id, challenge, selfie_r2_key, status)
     values ('11111111-1111-1111-1111-111111111111', 'turn_left', 'forged', 'passed') $$,
  null,
  'a user cannot write themselves a passed attempt'
);

select throws_ok(
  $$ update verification_attempts set status = 'passed'
      where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  null,
  'a user cannot promote their own attempt to passed'
);

select throws_ok(
  $$ delete from verification_attempts
      where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  null,
  'a user cannot delete a failed attempt to clear the record'
);

select throws_ok(
  $$ select record_verification_result(
       'aaaaaaaa-0000-4000-8000-000000000001', 'passed', null) $$,
  null,
  'recording a result is not reachable by a signed-in user'
);

select throws_ok(
  $$ select review_verification('aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  null,
  'a user cannot review their own attempt'
);

select is(
  (select count(*) from list_verification_reviews())::int, 0,
  'the review queue is empty for someone who is not a moderator'
);

-- Ben, another ordinary user -------------------------------------------------
set local request.jwt.claims = '{
  "sub": "22222222-2222-2222-2222-222222222222",
  "role": "authenticated"
}';

select is(
  (select count(*) from verification_attempts
    where profile_id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'a user cannot read somebody else''s selfie key or verdict'
);

-- Cleo, a moderator ----------------------------------------------------------
set local request.jwt.claims = '{
  "sub": "33333333-3333-3333-3333-333333333333",
  "role": "authenticated",
  "app_metadata": { "moderator": true }
}';

select is(
  (select count(*) from list_verification_reviews())::int, 1,
  'a moderator sees exactly the attempts waiting on a human'
);

select is(
  (select display_name from list_verification_reviews() limit 1), 'Ana',
  'the queue names the person so a moderator can judge the photo against them'
);

select lives_ok(
  $$ select review_verification('aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  'a moderator can approve an attempt a machine would not'
);

select is(
  (select photo_verified from profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  true,
  'approving at review verifies the profile'
);

-- The selfie is destroyed whichever way the decision went, and without the
-- moderator having to remember. Read as the owner: deleted_media is drained by
-- the service role and is deliberately in no client grant at all.
reset role;

select is(
  (select count(*) from deleted_media where r2_key = 'verification/ana-1')::int, 1,
  'reviewing queues the selfie for deletion from storage'
);

set local role authenticated;

select throws_ok(
  $$ select review_verification('aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  '42704',
  'attempt not found or already resolved',
  'a resolved attempt cannot be reviewed twice'
);

select is(
  (select count(*) from list_verification_reviews())::int, 0,
  'a reviewed attempt leaves the queue'
);

-- The service role, which is what the Edge Function runs as -----------------
reset role;
set local role service_role;

select lives_ok(
  $$ select record_verification_result(
       'aaaaaaaa-0000-4000-8000-000000000002', 'passed', null) $$,
  'the scanner can record a pass'
);

-- Read as the owner. 0009 deliberately withheld profiles from service_role and
-- this flow does not change that: the function is security definer, so the
-- scanner sets photo_verified through it and still cannot touch the table.
reset role;

select is(
  (select photo_verified from profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  true,
  'a passed attempt is the only automatic route to photo_verified'
);

select is(
  (select count(*) from information_schema.role_table_grants
    where grantee = 'service_role' and table_name = 'profiles'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE'))::int,
  0,
  'the scanner still holds no direct privilege on profiles'
);

set local role service_role;

select throws_ok(
  $$ select record_verification_result(
       'aaaaaaaa-0000-4000-8000-000000000002', 'pending', null) $$,
  '22023',
  'a result cannot leave the attempt pending',
  'recording a result has to actually resolve the attempt'
);

-- Rate limit. Two rows exist for nobody yet, so five more puts Cleo on the
-- limit and bounds what a retry loop can spend on Rekognition.
reset role;

insert into verification_attempts (profile_id, challenge, selfie_r2_key)
select '33333333-3333-3333-3333-333333333333', 'turn_right', 'verification/cleo-' || n
  from generate_series(1, 5) as n;

select throws_ok(
  $$ insert into verification_attempts (profile_id, challenge, selfie_r2_key)
     values ('33333333-3333-3333-3333-333333333333', 'turn_right', 'verification/cleo-6') $$,
  '53400',
  'verification rate limit exceeded',
  'a retry loop cannot spend the AWS budget, even as the service role'
);

select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_verification_result'
      and has_function_privilege('authenticated', p.oid, 'execute'))::int,
  0,
  'authenticated holds no execute grant on the function that sets photo_verified'
);

select * from finish();
rollback;
