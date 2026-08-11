-- OpenHeart :: swipe rate limiting
--
-- The limit exists to stop a script enumerating a city and right-swiping all of
-- it. These assert the boundary, that the refusal is distinguishable from a
-- permission error, and that a refused swipe creates no match.

begin;
select plan(5);

-- 502 targets: enough to cross a 500 limit and still have one left over.
insert into auth.users (id, instance_id, aud, role, email)
select
  ('faceb00c-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'rate' || n || '@test.dev'
from generate_series(0, 502) as n;

insert into profiles (id, display_name, birthdate)
select
  ('faceb00c-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  'Rate ' || n,
  '1995-01-01'::date
from generate_series(0, 502) as n;

-- Profile 0 is the swiper.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "faceb00c-0000-4000-8000-000000000000",
  "role": "authenticated"
}';

-- 499 swipes: one below the limit.
insert into swipes (swiper_id, target_id, direction)
select
  'faceb00c-0000-4000-8000-000000000000',
  ('faceb00c-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  'pass'
from generate_series(1, 499) as n;

select is(
  (select count(*)::int from swipes
    where swiper_id = 'faceb00c-0000-4000-8000-000000000000'),
  499,
  '499 swipes in an hour are allowed'
);

select lives_ok(
  $$ insert into swipes (swiper_id, target_id, direction)
     values ('faceb00c-0000-4000-8000-000000000000',
             'faceb00c-0000-4000-8000-0000000001f4', 'pass') $$,
  'the 500th is still allowed, so the limit is a ceiling and not an off by one'
);

select throws_ok(
  $$ insert into swipes (swiper_id, target_id, direction)
     values ('faceb00c-0000-4000-8000-000000000000',
             'faceb00c-0000-4000-8000-0000000001f5', 'pass') $$,
  '53400',
  null,
  'the 501st is refused'
);

-- The 53400 in the throws_ok above is the point: it is not 42501, so the client
-- can tell a rate limit from a permission failure and say something true about
-- it rather than showing a generic error.

-- A refused swipe must not reach the match trigger.
reset role;

insert into swipes (swiper_id, target_id, direction)
values ('faceb00c-0000-4000-8000-0000000001f5',
        'faceb00c-0000-4000-8000-000000000000', 'like');

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "faceb00c-0000-4000-8000-000000000000",
  "role": "authenticated"
}';

select throws_ok(
  $$ insert into swipes (swiper_id, target_id, direction)
     values ('faceb00c-0000-4000-8000-000000000000',
             'faceb00c-0000-4000-8000-0000000001f5', 'like') $$,
  '53400',
  null,
  'a rate limited like is refused even when it would have matched'
);

reset role;

select is(
  (select count(*)::int from matches
    where user_a = 'faceb00c-0000-4000-8000-000000000000'
       or user_b = 'faceb00c-0000-4000-8000-000000000000'),
  0,
  'and it created no match, because the limit runs before the match trigger'
);

select * from finish();
rollback;
