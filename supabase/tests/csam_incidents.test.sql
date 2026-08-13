-- OpenHeart :: known-material incident records
--
-- The incident is the only thing that outlives the object, so what matters is
-- that it survives every way the photo and the account can go away, and that
-- the person it is about can never see it.
--
-- Every count is scoped to this fixture. The first version counted the whole
-- table and passed only on an empty database, which stopped being true the
-- moment a real scan had ever run against this local stack.

begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('eeee0000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'up@test.dev'),
  ('eeee0000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mod@test.dev');

insert into profiles (id, display_name, birthdate) values
  ('eeee0000-0000-4000-8000-000000000001', 'Uploader', '1995-01-01'),
  ('eeee0000-0000-4000-8000-000000000002', 'Mod', '1990-01-01');

insert into photos (id, profile_id, r2_key, position) values
  ('eeee0000-0000-4000-8000-0000000000aa',
   'eeee0000-0000-4000-8000-000000000001', 'quarantine/known', 0);

insert into csam_incidents (profile_id, photo_id, r2_key, classification) values
  ('eeee0000-0000-4000-8000-000000000001',
   'eeee0000-0000-4000-8000-0000000000aa', 'quarantine/known', 'csam');

-- The whole reason this table exists. Deleting the photo is a thing its owner
-- can do at any time, and the record of what was in it must not go too.
delete from photos where id = 'eeee0000-0000-4000-8000-0000000000aa';

select is(
  (select count(*) from csam_incidents
    where profile_id = 'eeee0000-0000-4000-8000-000000000001')::int,
  1,
  'the incident survives its photo being deleted'
);

select is(
  (select r2_key from csam_incidents
    where profile_id = 'eeee0000-0000-4000-8000-000000000001'),
  'quarantine/known',
  'and still names the object, after the row that held the key is gone'
);

-- ------------------------------------------------------------- the uploader

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "eeee0000-0000-4000-8000-000000000001",
  "role": "authenticated"
}';

select is(
  (select count(*) from csam_incidents)::int, 0,
  'the person the incident is about cannot see it, or any other'
);

select is(
  (select count(*) from list_csam_incidents())::int, 0,
  'and the queue function tells them nothing either'
);

reset role;

select throws_ok(
  format(
    $$ set local role authenticated;
       set local request.jwt.claims = '{"sub": "eeee0000-0000-4000-8000-000000000001",
                                        "role": "authenticated"}';
       select review_csam_incident(%L) $$,
    (select id from csam_incidents
      where profile_id = 'eeee0000-0000-4000-8000-000000000001')
  ),
  '42501',
  null,
  'and cannot review their own incident'
);

-- ------------------------------------------------------------- a moderator

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "eeee0000-0000-4000-8000-000000000002",
  "role": "authenticated",
  "app_metadata": {"moderator": true}
}';

select is(
  (select count(*) from list_csam_incidents()
    where profile_id = 'eeee0000-0000-4000-8000-000000000001')::int,
  1,
  'a moderator sees the open incident'
);

select is(
  (select classification from list_csam_incidents()
    where profile_id = 'eeee0000-0000-4000-8000-000000000001'),
  'csam',
  'and is told which classification it was, not just that it was rejected'
);

reset role;

select review_csam_incident(
  (select id from csam_incidents
    where profile_id = 'eeee0000-0000-4000-8000-000000000001'),
  'reported',
  'NCMEC-12345'
);

select ok(
  (select reported_at is not null and report_reference = 'NCMEC-12345'
     from csam_incidents
    where profile_id = 'eeee0000-0000-4000-8000-000000000001'),
  'recording a reference stamps the time it was reported'
);

-- Open by default and reviewed once acted on, so the queue drains.
select is(
  (select count(*) from list_csam_incidents()
    where profile_id = 'eeee0000-0000-4000-8000-000000000001')::int,
  0,
  'a reviewed incident leaves the open queue'
);

select * from finish();
rollback;
