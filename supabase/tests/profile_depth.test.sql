-- OpenHeart :: the depth fields and prompts, and who may read or write them
--
-- 0021 added ten columns and a table. The columns are useless without a select
-- grant naming each one, because 0016 narrowed profiles to an explicit list,
-- and dangerous without an insert grant that still refuses the fields the
-- safety model depends on. Both directions are asserted here.
--
-- The three prompt cap is schema rather than a trigger, so it is tested as
-- schema: a fourth row has no position left to take.

begin;
select plan(24);

-- fixtures -------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaa0000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev'),
  ('bbbb0000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.dev'),
  ('cccc0000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cleo@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified, location) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ana', '1995-03-04', true,
   ST_SetSRID(ST_MakePoint(-0.1276, 51.5072), 4326)::geography),
  ('bbbb0000-0000-0000-0000-000000000002', 'Ben', '1990-01-01', true,
   ST_SetSRID(ST_MakePoint(-0.0876, 51.5136), 4326)::geography),
  ('cccc0000-0000-0000-0000-000000000003', 'Cleo', '1992-06-15', true,
   ST_SetSRID(ST_MakePoint(-0.0900, 51.5100), 4326)::geography);

update profiles
   set height_cm = 174, relationship_intent = 'long_term', drinking = 'sometimes',
       smoking = 'never', exercise = 'often', children = 'want_someday',
       education = 'undergraduate', job_title = 'Nurse',
       languages = array['en', 'es'], interests = array['climbing', 'baking']
 where id = 'bbbb0000-0000-0000-0000-000000000002';

insert into profile_prompts (profile_id, prompt, answer, position) values
  ('bbbb0000-0000-0000-0000-000000000002', 'two_truths', 'I have never seen the sea.', 0),
  ('bbbb0000-0000-0000-0000-000000000002', 'sunday', 'Bread, badly.', 1);

-- Ana and Ben are matched. Cleo is a stranger who has blocked Ben.
insert into matches (user_a, user_b) values
  ('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002');

insert into blocks (blocker_id, blocked_id) values
  ('cccc0000-0000-0000-0000-000000000003', 'bbbb0000-0000-0000-0000-000000000002');

-- constraints ----------------------------------------------------------------

select throws_ok(
  $$ update profiles set height_cm = 300 where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '23514', null, 'an impossible height is refused'
);

select throws_ok(
  $$ update profiles set relationship_intent = 'whatever'
      where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '23514', null, 'an intent outside the list is refused'
);

select throws_ok(
  $$ update profiles set drinking = 'daily' where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '23514', null, 'a lifestyle value outside the list is refused'
);

select throws_ok(
  $$ update profiles
        set interests = array['a','b','c','d','e','f','g','h','i']
      where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '23514', null, 'a ninth interest is refused'
);

select throws_ok(
  $$ insert into profile_prompts (profile_id, prompt, answer, position)
     values ('bbbb0000-0000-0000-0000-000000000002', 'fourth', 'No room.', 3) $$,
  '23514', null, 'a fourth prompt has no position left to take'
);

select throws_ok(
  $$ insert into profile_prompts (profile_id, prompt, answer, position)
     values ('bbbb0000-0000-0000-0000-000000000002', 'another', 'Taken.', 0) $$,
  '23505', null, 'two prompts cannot share a position'
);

select throws_ok(
  $$ insert into profile_prompts (profile_id, prompt, answer, position)
     values ('bbbb0000-0000-0000-0000-000000000002', 'sunday', 'Again.', 2) $$,
  '23505', null, 'the same question cannot be answered twice'
);

select throws_ok(
  $$ insert into profile_prompts (profile_id, prompt, answer, position)
     values ('bbbb0000-0000-0000-0000-000000000002', 'blank', '   ', 2) $$,
  '23514', null, 'a whitespace answer is refused'
);

-- grants ---------------------------------------------------------------------

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'height_cm', 'select'),
  'a new column is named in the select grant, or it is invisible to every client'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'interests', 'update'),
  'interests is writable by its owner'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'relationship_intent', 'insert'),
  'intent can be set during onboarding'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'photo_verified', 'update'),
  'the anti-bot gate is still not client writable'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'birthdate', 'update'),
  'birthdate is still immutable through the grant'
);

-- has_column_privilege, not has_table_privilege: 0021 grants insert on a
-- column list, and the table level check does not see a column level grant.
select ok(
  has_column_privilege('authenticated', 'public.profile_prompts', 'answer', 'insert'),
  'a person may write their own prompts'
);

-- reads ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

select is(
  (select height_cm from profiles where id = 'bbbb0000-0000-0000-0000-000000000002'),
  174::smallint,
  'a matched person can read height'
);

select is(
  (select relationship_intent from profiles where id = 'bbbb0000-0000-0000-0000-000000000002'),
  'long_term',
  'a matched person can read intent'
);

select is(
  (select interests from profiles where id = 'bbbb0000-0000-0000-0000-000000000002'),
  array['climbing', 'baking'],
  'a matched person can read interests'
);

select is(
  (select count(*)::int from profile_prompts
    where profile_id = 'bbbb0000-0000-0000-0000-000000000002'),
  2,
  'a matched person can read answered prompts'
);

select throws_ok(
  $$ select birthdate from profiles where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '42501', null, 'the depth grant did not widen anything back open'
);

-- Nothing in 0021 may let one person edit another person's profile. The write
-- is a plain statement that RLS quietly matches no rows, so the assertion is
-- that the value afterwards is the one the fixture set.
update profiles set height_cm = 150 where id = 'bbbb0000-0000-0000-0000-000000000002';

select is(
  (select height_cm from profiles where id = 'bbbb0000-0000-0000-0000-000000000002'),
  174::smallint,
  'one person cannot rewrite another person height'
);

update profile_prompts set answer = 'Not mine to write.'
 where profile_id = 'bbbb0000-0000-0000-0000-000000000002';

select is(
  (select answer from profile_prompts
    where profile_id = 'bbbb0000-0000-0000-0000-000000000002' and position = 1),
  'Bread, badly.',
  'one person cannot rewrite another person prompts'
);

-- a blocked stranger ---------------------------------------------------------

set local request.jwt.claims = '{"sub": "cccc0000-0000-0000-0000-000000000003",
                                 "role": "authenticated"}';

select is(
  (select count(*)::int from profile_prompts
    where profile_id = 'bbbb0000-0000-0000-0000-000000000002'),
  0,
  'someone on the other side of a block reads no prompts'
);

-- own row --------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "bbbb0000-0000-0000-0000-000000000002",
                                 "role": "authenticated"}';

select is(
  (select job_title from (select * from my_profile()) mine),
  'Nurse',
  'my_profile still returns the whole row including the new columns'
);

update profiles set height_cm = 176 where id = 'bbbb0000-0000-0000-0000-000000000002';

select is(
  (select height_cm from (select * from my_profile()) mine),
  176::smallint,
  'a person may edit their own height'
);

select * from finish();
rollback;
