-- OpenHeart :: undoing the last swipe
--
-- The dangerous case is undoing a swipe that already created a match. The other
-- person has been told, and may already have opened the conversation, so taking
-- it back is deleting their match rather than undoing yours. Asserted here
-- rather than trusted to the client never offering the button.

begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaa0000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev'),
  ('bbbb0000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.dev'),
  ('cccc0000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cleo@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ana', '1995-03-04', true),
  ('bbbb0000-0000-0000-0000-000000000002', 'Ben', '1990-01-01', true),
  ('cccc0000-0000-0000-0000-000000000003', 'Cleo', '1992-06-15', true);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

select is(
  (select undo_last_swipe()),
  null,
  'undoing nothing returns nothing rather than raising'
);

-- a plain pass ---------------------------------------------------------------

insert into swipes (swiper_id, target_id, direction)
values ('aaaa0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000003', 'pass');

select is(
  (select undo_last_swipe()),
  'cccc0000-0000-0000-0000-000000000003'::uuid,
  'the last swipe comes back as the id that was undone'
);

select is(
  (select count(*)::int from swipes where swiper_id = 'aaaa0000-0000-0000-0000-000000000001'),
  0,
  'and the row is gone, so the profile returns to the deck'
);

-- only the most recent -------------------------------------------------------

insert into swipes (swiper_id, target_id, direction, created_at) values
  ('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002', 'pass',
   now() - interval '30 seconds'),
  ('aaaa0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000003', 'pass',
   now() - interval '5 seconds');

select is(
  (select undo_last_swipe()),
  'cccc0000-0000-0000-0000-000000000003'::uuid,
  'the newest swipe is the one undone, not an arbitrary one'
);

select is(
  (select count(*)::int from swipes where swiper_id = 'aaaa0000-0000-0000-0000-000000000001'),
  1,
  'the older swipe is untouched'
);

-- the window -----------------------------------------------------------------

set local role postgres;
update swipes set created_at = now() - interval '10 minutes'
 where swiper_id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

select throws_ok(
  'select undo_last_swipe()',
  'P0001', 'too late to undo',
  'an old swipe cannot be rewritten'
);

-- a swipe that matched -------------------------------------------------------

set local role postgres;
delete from swipes where swiper_id = 'aaaa0000-0000-0000-0000-000000000001';

-- Ben likes Ana first, then Ana likes Ben, which fires the trigger from 0003.
insert into swipes (swiper_id, target_id, direction)
values ('bbbb0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001', 'like');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

insert into swipes (swiper_id, target_id, direction)
values ('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002', 'like');

select is(
  (select count(*)::int from matches
    where user_a = least('aaaa0000-0000-0000-0000-000000000001'::uuid,
                         'bbbb0000-0000-0000-0000-000000000002'::uuid)),
  1,
  'the mutual like created a match'
);

select throws_ok(
  'select undo_last_swipe()',
  'P0002', 'that one matched',
  'a swipe that matched cannot be undone, because it is not only yours'
);

select is(
  (select count(*)::int from swipes
    where swiper_id = 'aaaa0000-0000-0000-0000-000000000001'),
  1,
  'and the swipe survives the refusal'
);

select * from finish();
rollback;
