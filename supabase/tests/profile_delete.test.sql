-- OpenHeart :: a profile row cannot be hard deleted by its owner
--
-- These assert the negative case, because the positive one looked fine for
-- fifteen migrations. Deleting your own profile is a reasonable thing for a
-- client to be able to do, right up until you notice every foreign key pointing
-- at profiles is ON DELETE CASCADE and one of them is reports.target_id.

begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaa0000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev'),
  ('bbbb0000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ana', '1995-01-01', true),
  ('bbbb0000-0000-0000-0000-000000000002', 'Ben', '1994-01-01', true);

insert into reports (reporter_id, target_id, reason) values
  ('bbbb0000-0000-0000-0000-000000000002',
   'aaaa0000-0000-0000-0000-000000000001', 'harassment');

insert into blocks (blocker_id, blocked_id) values
  ('bbbb0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001');

-- ------------------------------------------------------------- the grant

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated cannot delete from profiles'
);

select is_empty(
  $$ select policyname from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and cmd = 'DELETE' $$,
  'no delete policy remains on profiles'
);

-- --------------------------------------------------------- the behaviour

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "aaaa0000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select throws_ok(
  $$ delete from profiles where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'deleting your own profile is refused outright'
);

reset role;

-- The point of refusing it. A cascade through reports.target_id is how an
-- account with a moderation history erases that history and registers again.

select is(
  (select count(*) from reports
    where target_id = 'aaaa0000-0000-0000-0000-000000000001'),
  1::bigint,
  'the report against that account survives'
);

select is(
  (select count(*) from blocks
    where blocked_id = 'aaaa0000-0000-0000-0000-000000000001'),
  1::bigint,
  'the block against that account survives'
);

-- Deletion still works, by the route that keeps the tombstone.

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "aaaa0000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select delete_my_account();

reset role;

select is(
  (select count(*) from profiles
    where id = 'aaaa0000-0000-0000-0000-000000000001'
      and deleted_at is not null and display_name = ''),
  1::bigint,
  'delete_my_account still anonymises the row and leaves it in place'
);

select * from finish();
rollback;
