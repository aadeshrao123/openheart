-- OpenHeart :: photo ownership and reordering
--
-- The reorder path is a security invoker function, so the policy is the only
-- thing standing between a caller and someone else's photos. Every assertion
-- below runs as authenticated with a real JWT claim, never as postgres.

begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email)
select
  ('aaaa1111-0000-4000-8000-00000000000' || n)::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'p' || n || '@test.dev'
from generate_series(1, 2) as n;

insert into profiles (id, display_name, birthdate)
select
  ('aaaa1111-0000-4000-8000-00000000000' || n)::uuid,
  'Photo User ' || n,
  '1995-01-01'::date
from generate_series(1, 2) as n;

-- Owner holds a full grid, so there is no spare slot to park a photo in.
insert into photos (id, profile_id, r2_key, position)
select
  ('bbbb1111-0000-4000-8000-00000000000' || n)::uuid,
  'aaaa1111-0000-4000-8000-000000000001',
  'quarantine/owner-' || n,
  n - 1
from generate_series(1, 6) as n;

insert into photos (id, profile_id, r2_key, position)
values ('cccc1111-0000-4000-8000-000000000001',
        'aaaa1111-0000-4000-8000-000000000002',
        'quarantine/stranger', 0);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "aaaa1111-0000-4000-8000-000000000001",
  "role": "authenticated"
}';

-- --------------------------------------------------------------- own photos

select is(
  (select count(*) from photos where profile_id = 'aaaa1111-0000-4000-8000-000000000001')::int,
  6,
  'a pending photo is visible to its owner so the grid can explain it'
);

select lives_ok(
  $$ update photos set position = 0 where id = 'bbbb1111-0000-4000-8000-000000000001' $$,
  'the owner can write position, which the grant promised and no policy allowed'
);

-- Swapping the ends of a full grid: the case with no free slot.
select lives_ok(
  $$ select set_photo_order(array[
       'bbbb1111-0000-4000-8000-000000000006',
       'bbbb1111-0000-4000-8000-000000000002',
       'bbbb1111-0000-4000-8000-000000000003',
       'bbbb1111-0000-4000-8000-000000000004',
       'bbbb1111-0000-4000-8000-000000000005',
       'bbbb1111-0000-4000-8000-000000000001'
     ]::uuid[]) $$,
  'a full grid can be reordered without a spare position'
);

select is(
  (select r2_key from photos
    where profile_id = 'aaaa1111-0000-4000-8000-000000000001' and position = 0),
  'quarantine/owner-6',
  'and the new order is the one that was asked for'
);

-- ------------------------------------------------------- somebody else's

select is(
  (select count(*) from photos where profile_id = 'aaaa1111-0000-4000-8000-000000000002')::int,
  0,
  'a stranger''s pending photo is not readable'
);

-- Reordering is authorized by the policy, not by the function. Passing another
-- user's id has to be a no-op rather than an error, because an error would
-- confirm the row exists.
select lives_ok(
  $$ select set_photo_order(array['cccc1111-0000-4000-8000-000000000001']::uuid[]) $$,
  'reordering a stranger''s photo does not raise'
);

reset role;

select is(
  (select position from photos where id = 'cccc1111-0000-4000-8000-000000000001'),
  0,
  'and it did not move'
);

-- ------------------------------------------------------- what stays closed

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "aaaa1111-0000-4000-8000-000000000001",
  "role": "authenticated"
}';

-- moderation_state is the verdict. The column grant is the enforcement point,
-- so this fails on privileges rather than on a policy.
select throws_ok(
  $$ update photos set moderation_state = 'approved'
      where id = 'bbbb1111-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'a user cannot approve their own photo'
);

select throws_ok(
  $$ update photos set r2_key = 'quarantine/stranger'
      where id = 'bbbb1111-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'a user cannot repoint a photo at another object'
);

-- ------------------------------------------------- deleting queues the object
--
-- Without this the row goes and the object stays in R2 with nothing naming it:
-- unreachable by the app and still fetchable by anyone holding the URL.

-- The queue is deny-all, so reading it to assert on it has to happen as the
-- superuser. That is also the next assertion: a client cannot read it at all.
select throws_ok(
  $$ select count(*) from deleted_media $$,
  '42501',
  null,
  'a user cannot read the purge queue, which names other people''s objects'
);

-- Deleted through the client path, as the owner, which is what the grid does.
delete from photos where r2_key = 'quarantine/owner-2';

reset role;

select is(
  (select count(*) from deleted_media where r2_key = 'quarantine/owner-2')::int,
  1,
  'deleting a photo queues its object for purge'
);

select is(
  (select count(*) from deleted_media where r2_key = 'quarantine/owner-1')::int,
  0,
  'and queues nothing for a photo that still exists'
);

select * from finish();
rollback;
