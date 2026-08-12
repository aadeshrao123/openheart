-- OpenHeart :: account lifecycle and privilege tests
--
-- Every assertion here corresponds to a bug that was actually present and was
-- caught by running the migrations rather than reading them. A clean `db push`
-- proved none of it.

begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaa0000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev'),
  ('bbbb0000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ana', '1995-01-01', true),
  ('bbbb0000-0000-0000-0000-000000000002', 'Ben', '1994-01-01', true);

insert into swipes (swiper_id, target_id, direction) values
  ('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002', 'like'),
  ('bbbb0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001', 'like');

insert into messages (match_id, sender_id, body)
select id, 'aaaa0000-0000-0000-0000-000000000001', 'hello' from matches;

insert into reports (reporter_id, target_id, reason) values
  ('bbbb0000-0000-0000-0000-000000000002',
   'aaaa0000-0000-0000-0000-000000000001', 'harassment');

-- ------------------------------------------------------ privilege boundaries

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "aaaa0000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select throws_ok(
  $$ update profiles set photo_verified = true
      where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'a user cannot self-verify their photo'
);

select throws_ok(
  $$ update profiles set birthdate = '2010-01-01'
      where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'a user cannot change their birthdate and walk past the age gate'
);

select lives_ok(
  $$ update profiles set bio = 'hello world'
      where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  'a user can still edit their own editable fields'
);

-- ----------------------------------------------------------------- deletion
--
-- Suspended first, and set as postgres because suspended_at is in no client
-- grant. Deleting the account is the obvious way to try to shed a suspension,
-- and the record of it has to outlive the profile it belongs to or the standard
-- ban-evasion move is: get suspended, delete, sign up again.

reset role;

update profiles
   set suspended_at = now(), suspended_reason = 'harassment'
 where id = 'aaaa0000-0000-0000-0000-000000000001';

set local role authenticated;

select delete_my_account();

reset role;

select ok(
  (select suspended_at is not null and suspended_reason = 'harassment'
     from profiles where id = 'aaaa0000-0000-0000-0000-000000000001'),
  'deleting a suspended account leaves the suspension on the tombstone'
);

select is(
  (select count(*) from profiles
    where id = 'aaaa0000-0000-0000-0000-000000000001')::int,
  1,
  'the profile row survives deletion as a tombstone'
);

select is(
  (select count(*) from auth.users
    where id = 'aaaa0000-0000-0000-0000-000000000001')::int,
  0,
  'the auth record and its email are gone'
);

select is(
  (select count(*) from reports)::int, 1,
  'reports about the deleted user survive, so ban evasion stays traceable'
);

select is(
  (select count(*) from messages)::int, 1,
  'the other participant keeps their conversation history'
);

select ok(
  (select display_name = '' and deleted_at is not null and not is_active
     from profiles where id = 'aaaa0000-0000-0000-0000-000000000001'),
  'the profile is anonymized, flagged deleted, and undiscoverable'
);

select * from finish();
rollback;
