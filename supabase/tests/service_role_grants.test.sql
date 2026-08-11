-- OpenHeart :: service_role table privileges
--
-- This file exists because both Edge Functions failed with 42501 "permission
-- denied for table photos" on their first real request. service_role has
-- rolbypassrls, and 0004 recorded that as "bypasses both grants and RLS", but
-- only the RLS half is true: GRANT is checked first and applies to every role.
--
-- Nothing in the application catches this. The functions typecheck, deploy and
-- return a plausible 500.

begin;
select plan(12);

-- ------------------------------------------------- what the functions need

select ok(
  has_table_privilege('service_role', 'photos', 'SELECT'),
  'request-photo-upload can count a profile''s photos'
);

select ok(
  has_table_privilege('service_role', 'photos', 'INSERT'),
  'request-photo-upload can reserve the row'
);

select ok(
  has_column_privilege('service_role', 'photos', 'moderation_state', 'UPDATE'),
  'moderate-photo can write the verdict'
);

select ok(
  has_table_privilege('service_role', 'deleted_media', 'INSERT'),
  'moderate-photo can queue a rejected key for purge'
);

select ok(
  has_table_privilege('service_role', 'deleted_media', 'SELECT'),
  'the purge job can read the queue'
);

select ok(
  has_column_privilege('service_role', 'deleted_media', 'purged_at', 'UPDATE'),
  'the purge job can stamp a key as purged'
);

-- --------------------------------------------- and nothing beyond that
--
-- The column list is the whitelist. A function that could rewrite r2_key or
-- position could repoint a row at another user's object, so these assert the
-- absence of privileges rather than the presence of a policy.

select ok(
  not has_column_privilege('service_role', 'photos', 'r2_key', 'UPDATE'),
  'service_role cannot repoint a photo at another object'
);

select ok(
  not has_column_privilege('service_role', 'photos', 'position', 'UPDATE'),
  'service_role cannot reorder a profile''s photos'
);

select ok(
  not has_column_privilege('service_role', 'photos', 'profile_id', 'UPDATE'),
  'service_role cannot reassign a photo to another profile'
);

select ok(
  not has_table_privilege('service_role', 'photos', 'DELETE'),
  'service_role cannot delete photo rows'
);

-- photo_verified is the anti-bot gate. The verification flow does not exist yet,
-- so nothing should be able to set it, including the service role. When that
-- flow lands it adds the column grant here and flips this assertion.
select ok(
  not has_column_privilege('service_role', 'profiles', 'photo_verified', 'UPDATE'),
  'nothing can set photo_verified until the verification flow exists'
);

-- The other side of the same coin: bypassrls is real, and is what lets the
-- functions see a pending row that no policy would expose.
select is(
  (select rolbypassrls from pg_roles where rolname = 'service_role'),
  true,
  'service_role still bypasses RLS, which is the half that was true'
);

select * from finish();
rollback;
