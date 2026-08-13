-- OpenHeart :: liking one thing, saying why, and who may see it
--
-- 0024 narrows one invariant on purpose: a like becomes readable by the person
-- it is aimed at. The half that matters is asserted here rather than assumed.
-- A pass must stay invisible to its target, and nothing may let one person read
-- swipes aimed at somebody else.

begin;
select plan(15);

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

insert into profile_prompts (profile_id, prompt, answer, position)
values ('aaaa0000-0000-0000-0000-000000000001', 'sunday', 'Bread, badly.', 0);

-- constraints ----------------------------------------------------------------

select throws_ok(
  $$ insert into swipes (swiper_id, target_id, direction, comment)
     values ('bbbb0000-0000-0000-0000-000000000002',
             'aaaa0000-0000-0000-0000-000000000001', 'pass', 'Nothing to say.') $$,
  '23514', null, 'a pass carries nothing'
);

select throws_ok(
  $$ insert into swipes (swiper_id, target_id, direction, liked_prompt, liked_photo_id)
     values ('bbbb0000-0000-0000-0000-000000000002',
             'aaaa0000-0000-0000-0000-000000000001', 'like', 'sunday',
             '11111111-1111-1111-1111-111111111111') $$,
  '23514', null, 'a like points at one thing, not two'
);

select throws_ok(
  $$ insert into swipes (swiper_id, target_id, direction, comment)
     values ('bbbb0000-0000-0000-0000-000000000002',
             'aaaa0000-0000-0000-0000-000000000001', 'like', '   ') $$,
  '23514', null, 'a whitespace comment is refused'
);

-- Ben likes Ana's answer and says something. Cleo passes on Ana.
insert into swipes (swiper_id, target_id, direction, liked_prompt, comment)
values ('bbbb0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001',
        'like', 'sunday', 'Badly is the only way worth doing it.');

insert into swipes (swiper_id, target_id, direction)
values ('cccc0000-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000001', 'pass');

-- what the target may read ---------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

select is(
  (select count(*)::int from swipes where target_id = 'aaaa0000-0000-0000-0000-000000000001'),
  1,
  'the like aimed at me is visible and the pass is not'
);

select is(
  (select comment from swipes where target_id = 'aaaa0000-0000-0000-0000-000000000001'),
  'Badly is the only way worth doing it.',
  'and it carries what they wrote'
);

select is(
  (select count(*)::int from likes_received()),
  1,
  'likes_received returns the one waiting'
);

select is(
  (select liked_prompt from likes_received()),
  'sunday',
  'and says which answer they picked'
);

select is(
  (select age from likes_received()),
  (extract(year from age(date '1990-01-01')))::int,
  'and an age, which the column grant would not allow a client to join for'
);

-- what a third party may read ------------------------------------------------

set local request.jwt.claims = '{"sub": "cccc0000-0000-0000-0000-000000000003",
                                 "role": "authenticated"}';

-- Cleo reads her own pass, which is hers. What she must not read is the like
-- Ben aimed at Ana.
select is(
  (select count(*)::int from swipes
    where swiper_id = 'bbbb0000-0000-0000-0000-000000000002'
      and target_id = 'aaaa0000-0000-0000-0000-000000000001'),
  0,
  'nobody reads a like that was aimed at somebody else'
);

select is(
  (select count(*)::int from likes_received()),
  0,
  'and likes_received shows a stranger nothing'
);

-- the opening message --------------------------------------------------------

set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

insert into swipes (swiper_id, target_id, direction, comment)
values ('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002',
        'like', 'It really is.');

set local role postgres;

select is(
  (select count(*)::int from matches
    where user_a = least('aaaa0000-0000-0000-0000-000000000001'::uuid,
                         'bbbb0000-0000-0000-0000-000000000002'::uuid)),
  1,
  'the mutual like still creates the match'
);

select is(
  (select count(*)::int from messages),
  2,
  'and both comments become the opening messages'
);

select is(
  (select body from messages order by created_at limit 1),
  'Badly is the only way worth doing it.',
  'oldest first, so the conversation reads in the order it happened'
);

select is(
  (select sender_id from messages order by created_at limit 1),
  'bbbb0000-0000-0000-0000-000000000002'::uuid,
  'attributed to whoever wrote it'
);

-- An answered like is no longer waiting.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

select is(
  (select count(*)::int from likes_received()),
  0,
  'a like already answered leaves the waiting list'
);

select * from finish();
rollback;
