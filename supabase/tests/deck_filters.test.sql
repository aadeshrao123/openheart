-- OpenHeart :: the deck filters from 0022
--
-- discover_profiles is security definer, so RLS protects none of the rows it
-- returns. A filter that silently does nothing is the failure mode here, and it
-- looks exactly like an empty city. Each one is asserted by counting who comes
-- back before and after it is set.
--
-- The filter columns are also the first on profiles that are deliberately not
-- readable by anyone, including their owner, off the table.

begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaa0000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev'),
  ('bbbb0000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.dev'),
  ('cccc0000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cleo@test.dev');

-- Ana looks. Ben is 180cm, long term, climbs, has a bio. Cleo is 160cm, short
-- term, bakes, no bio.
insert into profiles
  (id, display_name, birthdate, photo_verified, location, bio,
   height_cm, relationship_intent, interests)
values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ana', '1995-03-04', true,
   ST_SetSRID(ST_MakePoint(-0.1276, 51.5072), 4326)::geography, 'Looking.',
   170, 'long_term', array['climbing']),
  ('bbbb0000-0000-0000-0000-000000000002', 'Ben', '1990-01-01', true,
   ST_SetSRID(ST_MakePoint(-0.1280, 51.5075), 4326)::geography, 'I climb things.',
   180, 'long_term', array['climbing', 'coffee']),
  ('cccc0000-0000-0000-0000-000000000003', 'Cleo', '1992-06-15', true,
   ST_SetSRID(ST_MakePoint(-0.1281, 51.5076), 4326)::geography, null,
   160, 'short_term', array['baking']);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaa0000-0000-0000-0000-000000000001",
                                 "role": "authenticated"}';

select is(
  (select count(*)::int from discover_profiles(20)),
  2,
  'with no filters set, everyone eligible is in the deck'
);

-- intent -----------------------------------------------------------------

set local role postgres;
update profiles set filter_intents = array['long_term']
 where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*)::int from discover_profiles(20)),
  1,
  'an intent filter excludes a different intent'
);

select is(
  (select display_name from discover_profiles(20)),
  'Ben',
  'and keeps the one that matches'
);

set local role postgres;
update profiles set filter_intents = null where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

-- interests --------------------------------------------------------------

set local role postgres;
update profiles set filter_interests = array['climbing']
 where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*)::int from discover_profiles(20)),
  1,
  'an interest filter keeps only an overlapping profile'
);

set local role postgres;
update profiles set filter_interests = array['skiing']
 where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*)::int from discover_profiles(20)),
  0,
  'an interest nobody shares empties the deck rather than being ignored'
);

set local role postgres;
update profiles set filter_interests = null where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

-- height -----------------------------------------------------------------

set local role postgres;
update profiles set filter_height_min_cm = 175
 where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*)::int from discover_profiles(20)),
  1,
  'a minimum height excludes anyone shorter'
);

set local role postgres;
update profiles set filter_height_min_cm = null, filter_height_max_cm = 165
 where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*)::int from discover_profiles(20)),
  1,
  'a maximum height excludes anyone taller'
);

set local role postgres;
update profiles set filter_height_max_cm = null
 where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

-- bio --------------------------------------------------------------------

set local role postgres;
update profiles set filter_has_bio = true where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*)::int from discover_profiles(20)),
  1,
  'requiring a bio excludes a blank one'
);

set local role postgres;
update profiles set filter_has_bio = false where id = 'aaaa0000-0000-0000-0000-000000000001';
set local role authenticated;

-- grants -----------------------------------------------------------------

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'filter_intents', 'select'),
  'a filter is not readable off the table, not even by its owner'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'filter_intents', 'update'),
  'but its owner may write it'
);

select is(
  (select filter_has_bio from (select * from my_profile()) mine),
  false,
  'and read it back through my_profile'
);

-- ordering ---------------------------------------------------------------

set local role postgres;

select throws_ok(
  $$ update profiles
        set filter_height_min_cm = 190, filter_height_max_cm = 150
      where id = 'aaaa0000-0000-0000-0000-000000000001' $$,
  '23514', null, 'an inverted height range is refused'
);

select * from finish();
rollback;
