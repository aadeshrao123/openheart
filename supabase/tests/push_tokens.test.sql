-- OpenHeart :: push token policies
--
-- The set of devices a person owns is not something anyone else needs. A policy
-- that wrongly grants access looks perfectly fine in the app.

begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('dddd0000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev1@test.dev'),
  ('dddd0000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev2@test.dev');

insert into profiles (id, display_name, birthdate) values
  ('dddd0000-0000-4000-8000-000000000001', 'Dev One', '1995-01-01'),
  ('dddd0000-0000-4000-8000-000000000002', 'Dev Two', '1994-01-01');

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "dddd0000-0000-4000-8000-000000000001",
  "role": "authenticated"
}';

select lives_ok(
  $$ select register_push_token('ExponentPushToken[one]', 'ios') $$,
  'a signed-in user can register their own device'
);

select is(
  (select profile_id from push_tokens where token = 'ExponentPushToken[one]'),
  'dddd0000-0000-4000-8000-000000000001'::uuid,
  'the token is claimed by the caller, never by a value they sent'
);

-- Called on every launch, so it has to be idempotent.
select lives_ok(
  $$ select register_push_token('ExponentPushToken[one]', 'ios') $$,
  'registering the same device twice updates rather than failing'
);

select is(
  (select count(*) from push_tokens)::int, 1,
  'one device is one row however many times the app is opened'
);

-- The function is the only write path, which is what stops a caller naming a
-- profile_id rather than being one.
select throws_ok(
  $$ insert into push_tokens (token, profile_id, platform)
     values ('ExponentPushToken[stolen]',
             'dddd0000-0000-4000-8000-000000000002', 'ios') $$,
  '42501',
  null,
  'a user cannot write this table directly, in their own name or anyone else''s'
);

-- The most sensitive read on this table.
set local request.jwt.claims = '{
  "sub": "dddd0000-0000-4000-8000-000000000002",
  "role": "authenticated"
}';

select is(
  (select count(*) from push_tokens)::int, 0,
  'another user sees no tokens at all, not even that one exists'
);

-- The same phone handed to a different person.
select lives_ok(
  $$ select register_push_token('ExponentPushToken[one]', 'android') $$,
  'a device can be re-registered by whoever is signed in on it now'
);

select is(
  (select profile_id from push_tokens where token = 'ExponentPushToken[one]'),
  'dddd0000-0000-4000-8000-000000000002'::uuid,
  'the device now belongs to the person actually holding it'
);

-- ------------------------------------------------------------------ deletion

select delete_my_account();

reset role;

select is(
  (select count(*) from push_tokens
    where profile_id = 'dddd0000-0000-4000-8000-000000000002')::int,
  0,
  'deleting the account takes its devices with it'
);

-- The cascade cannot do this: the profile row survives as a tombstone, so
-- on delete cascade never fires.
select is(
  (select count(*) from profiles
    where id = 'dddd0000-0000-4000-8000-000000000002')::int,
  1,
  'and does it without the cascade, because the profile row survives'
);

select * from finish();
rollback;
