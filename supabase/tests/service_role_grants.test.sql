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
select plan(21);

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

-- Added after request-verification turned out never to have worked. 0017
-- created the table, granted select to authenticated, and did not grant
-- anything to service_role, so the insert failed with 42501 and the app showed
-- a generic error. The rule at the top of 0009 predates that table by eight
-- migrations.

select ok(
  has_table_privilege('service_role', 'verification_attempts', 'INSERT'),
  'request-verification can write the attempt row'
);

select ok(
  has_table_privilege('service_role', 'verification_attempts', 'SELECT'),
  'verify-selfie and review-selfie can read the attempt back'
);

select ok(
  not has_table_privilege('service_role', 'verification_attempts', 'UPDATE'),
  'and cannot write a verdict, which only the security definer functions may do'
);

select ok(
  has_table_privilege('service_role', 'push_tokens', 'SELECT'),
  'send-push can read a recipient''s devices'
);

select ok(
  has_table_privilege('service_role', 'push_tokens', 'DELETE'),
  'and can drop a token Expo reported as dead'
);

-- The guard that catches the next one. Listing tables by hand is exactly how
-- verification_attempts was missed: this file was written when photos and
-- deleted_media were the only two, and adding a table did not add a line here.
--
-- Pinning the whole set means a new write grant fails this test until somebody
-- writes down why it exists, and a grant that disappears fails it too.
--
-- Filtered on row security rather than by name. Every table this project owns
-- has RLS, asserted in rls_everywhere.test.sql, and nothing else in public
-- does: the three PostGIS relations carry write grants from the extension and
-- are not ours to reason about.
select is(
  (select string_agg(distinct g.table_name, ', ' order by g.table_name)
     from information_schema.role_table_grants g
     join pg_class c on c.relname = g.table_name
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where g.grantee = 'service_role'
      and g.table_schema = 'public'
      and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      and c.relrowsecurity),
  'csam_incidents, deleted_media, photos, push_tokens, verification_attempts',
  'exactly these tables are writable by an Edge Function, no more and no fewer'
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

-- photo_verified is the anti-bot gate. This used to say the verification flow
-- did not exist yet and that landing it would flip this assertion. The flow
-- landed in 0017 and this stayed false, which is the better outcome: the verdict
-- is written by record_verification_result and review_verification, both
-- security definer, so the grant was never needed. A key that could set
-- photo_verified directly is a key that can verify an impostor.
select ok(
  not has_column_privilege('service_role', 'profiles', 'photo_verified', 'UPDATE'),
  'the anti-bot gate is reachable only through the functions allowed to set it'
);

-- Added after the same bug happened a fifth time. 0020 added
-- photos.moderation_detail, the existing grant was the column list
-- `update (moderation_state)`, and a new column is never covered by one. The
-- scanner could not record what it had just decided.
select ok(
  has_column_privilege('service_role', 'photos', 'moderation_detail', 'UPDATE'),
  'moderate-photo can record which scanner objected, not just that one did'
);

-- Suspending on a known-material match goes through a security definer
-- function, so this stays false. A key that can write one column of profiles is
-- a key that can be talked into writing others.
select ok(
  not has_column_privilege('service_role', 'profiles', 'suspended_at', 'UPDATE'),
  'service_role still cannot touch profiles directly, suspension included'
);

select ok(
  has_function_privilege('service_role', 'suspend_for_known_material(uuid, text)', 'EXECUTE'),
  'and reaches suspension only through the function that is allowed to'
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
