-- OpenHeart :: what one person may read off another person's profile
--
-- RLS decides which rows. The grant decides which columns, and until 0016 it
-- was the whole table, so every row a policy allowed handed the exact date of
-- birth and the stored coordinates over with it. Reproduced before the fix:
-- as a matched user, `select birthdate, location from profiles where id = <the
-- other person>` returned 1988-11-23 and the point (-0.09, 51.51).
--
-- These assert the negative case. A read that is merely never issued by the app
-- is not a read that is refused, so every one of them goes through the same
-- role and claims the client arrives with.

begin;
select plan(27);

-- fixtures -------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaa0000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev'),
  ('bbbb0000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.dev'),
  ('cccc0000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cleo@test.dev'),
  ('dddd0000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dana@test.dev'),
  ('eeee0000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@test.dev');

-- Three birthdates anchored to today rather than written out, so the age
-- assertions below cannot rot into passing by accident next year. Ben turns 30
-- tomorrow, Cleo turned 30 yesterday, Dana is 30 today.
insert into profiles (id, display_name, birthdate, photo_verified, location) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ana', '1995-03-04', true,
   ST_SetSRID(ST_MakePoint(-0.1276, 51.5072), 4326)::geography),
  ('bbbb0000-0000-0000-0000-000000000002', 'Ben',
   (current_date - interval '30 years' + interval '1 day')::date, true,
   ST_SetSRID(ST_MakePoint(-0.0876, 51.5136), 4326)::geography),
  ('cccc0000-0000-0000-0000-000000000003', 'Cleo',
   (current_date - interval '30 years' - interval '1 day')::date, true, null),
  ('dddd0000-0000-0000-0000-000000000004', 'Dana',
   (current_date - interval '30 years')::date, true, null),
  ('eeee0000-0000-0000-0000-000000000005', 'Eve', '1990-06-06', true, null);

-- Through the swipe trigger, so the matches are real ones. Eve matches nobody.
insert into swipes (swiper_id, target_id, direction) values
  ('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002', 'like'),
  ('bbbb0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001', 'like'),
  ('aaaa0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000003', 'like'),
  ('cccc0000-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000001', 'like'),
  ('aaaa0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000004', 'like'),
  ('dddd0000-0000-0000-0000-000000000004', 'aaaa0000-0000-0000-0000-000000000001', 'like');

-- the privilege ---------------------------------------------------------------

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'birthdate', 'SELECT'),
  'authenticated holds no select privilege on profiles.birthdate'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'location', 'SELECT'),
  'authenticated holds no select privilege on profiles.location'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'SELECT'),
  'the grant is a column list and not a revocation: display_name still reads'
);

-- as Ana, who is matched with Ben ---------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "aaaa0000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select throws_ok(
  $$ select birthdate from profiles
      where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'a matched user cannot read the other person''s date of birth'
);

select throws_ok(
  $$ select location from profiles
      where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'a matched user cannot read the other person''s coordinates'
);

select throws_ok(
  $$ select * from profiles
      where id = 'bbbb0000-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'select *, which is what PostgREST sends for select(*), is refused with them'
);

select throws_ok(
  $$ select * from profiles
      where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'and refused on your own row too, because a column grant does not know whose'
);

select is(
  (select display_name from profiles
    where id = 'bbbb0000-0000-0000-0000-000000000002'),
  'Ben',
  'the columns a profile is rendered from still read'
);

-- the age a match is shown ----------------------------------------------------

select is(
  match_age('bbbb0000-0000-0000-0000-000000000002'),
  29,
  'the day before a birthday, a match is still shown the younger age'
);

select is(
  match_age('cccc0000-0000-0000-0000-000000000003'),
  30,
  'the day after a birthday, a match is shown the older one'
);

select is(
  match_age('dddd0000-0000-0000-0000-000000000004'),
  30,
  'on the birthday itself, the age has turned over'
);

select ok(
  match_age('eeee0000-0000-0000-0000-000000000005') is null,
  'match_age says nothing about someone you are not matched with'
);

select ok(
  match_age('aaaa0000-0000-0000-0000-000000000001') is null,
  'and nothing about you, which is not a match row'
);

-- your own row ----------------------------------------------------------------

select is(
  (select count(*) from my_profile())::int,
  1,
  'my_profile returns exactly one row, the caller''s'
);

select is(
  (select birthdate from my_profile()),
  '1995-03-04'::date,
  'your own date of birth still reaches you'
);

select ok(
  (select location is not null from my_profile()),
  'and so does your own location, which the filters screen needs'
);

select is(
  (select count(*) from my_profile()
    where id <> 'aaaa0000-0000-0000-0000-000000000001')::int,
  0,
  'my_profile can return no row but the caller''s'
);

-- the writes the client still makes -------------------------------------------
--
-- Reading a column and writing it are separate privileges. The app writes its
-- own location on every foreground and never reads one back, and both of its
-- profile mutations ask for the id back to tell a write that landed from one
-- that matched no row.

select lives_ok(
  $$ update profiles
        set location = ST_SetSRID(ST_MakePoint(-0.09, 51.51), 4326)::geography
      where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  'a user can still write the location it is no longer allowed to read'
);

select lives_ok(
  $$ update profiles set bio = 'hello world'
      where id = 'aaaa0000-0000-0000-0000-000000000001'
      returning id $$,
  'and can still save an edit and have the row confirm itself by id'
);

-- as Ben, who is a third party to Ana's row -----------------------------------

set local request.jwt.claims = '{
  "sub": "bbbb0000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select is(
  (select id from my_profile()),
  'bbbb0000-0000-0000-0000-000000000002'::uuid,
  'a second caller gets their own row from the same function'
);

select is(
  (select count(*) from my_profile()
    where id = 'aaaa0000-0000-0000-0000-000000000001')::int,
  0,
  'a match cannot reach the other person''s private fields through my_profile'
);

-- as an unauthenticated caller ------------------------------------------------

reset role;
set local role anon;

select throws_ok(
  $$ select display_name from profiles $$,
  '42501',
  null,
  'an anonymous caller reads no column of profiles at all'
);

select throws_ok(
  $$ select * from my_profile() $$,
  '42501',
  null,
  'and cannot call my_profile, which is granted to authenticated only'
);

select throws_ok(
  $$ select match_age('bbbb0000-0000-0000-0000-000000000002') $$,
  '42501',
  null,
  'and cannot call match_age either'
);

-- what 0015 established, still true after the grant changed -------------------

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated still cannot delete from profiles'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "aaaa0000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select throws_ok(
  $$ delete from profiles where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'deleting your own profile is still refused outright'
);

-- delete_my_account is security definer, so narrowing the client's grant must
-- not have taken the one supported route out with it.
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
