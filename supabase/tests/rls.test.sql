-- OpenHeart :: RLS tests
--   run with:  supabase test db
--
-- These assert the *negative* cases. A policy that grants access is obvious
-- when it breaks; a policy that fails to deny access is invisible until it is
-- on the front page. Every new policy gets a test here that proves a user who
-- should not see a row does not see it.

begin;
select plan(8);

-- fixtures -------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified) values
  ('11111111-1111-1111-1111-111111111111', 'Ana',  '1995-01-01', true),
  ('22222222-2222-2222-2222-222222222222', 'Ben',  '1994-01-01', true),
  ('33333333-3333-3333-3333-333333333333', 'Cleo', '1993-01-01', true),
  ('44444444-4444-4444-4444-444444444444', 'Dan',  '1992-01-01', true);

-- Ben likes Ana, Dan passes on her, and Dan also likes Cleo, which is nothing
-- to do with Ana at all.
insert into swipes (swiper_id, target_id, direction) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'like'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'pass'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'like');

insert into blocks (blocker_id, blocked_id) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');

-- act as Ana ------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "11111111-1111-1111-1111-111111111111",
  "role": "authenticated"
}';

-- 0024 narrowed this on purpose. A like aimed at you is readable, because that
-- is the only way to show an incoming like at all and the alternative is
-- charging for it. A pass is still invisible to the person passed on, and a
-- swipe between two other people is invisible to everyone.
select is(
  (select count(*) from swipes where direction = 'pass')::int, 0,
  'a pass never reaches the person who was passed on'
);

select is(
  (select count(*) from swipes
    where swiper_id = '44444444-4444-4444-4444-444444444444'
      and target_id = '33333333-3333-3333-3333-333333333333')::int, 0,
  'a swipe between two other people is nobody else business'
);

select is(
  (select count(*) from profiles where id = '33333333-3333-3333-3333-333333333333')::int, 0,
  'a user cannot see the profile of someone who blocked them'
);

select is(
  (select count(*) from blocks)::int, 0,
  'a user cannot see that someone blocked them'
);

select throws_ok(
  $$ insert into swipes (swiper_id, target_id, direction)
     values ('22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333', 'like') $$,
  null,
  'a user cannot forge a swipe on behalf of another user'
);

select throws_ok(
  $$ update profiles set photo_verified = true
      where id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  'a user cannot self-verify their photo'
);

-- mutual like creates exactly one match ---------------------------------------
insert into swipes (swiper_id, target_id, direction) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'like');

select is(
  (select count(*) from matches)::int, 1,
  'a mutual like creates exactly one match'
);

reset role;

select is(
  (select count(*) from matches
    where user_a < user_b)::int, 1,
  'match rows are stored in canonical order so duplicates cannot exist'
);

select * from finish();
rollback;
