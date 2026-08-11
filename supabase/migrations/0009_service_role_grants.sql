-- OpenHeart :: table privileges for service_role
--
-- 0006 granted every privilege the client needs and none for service_role, on
-- the assumption recorded in 0004 that "the service role bypasses both grants
-- and RLS". Half of that is true. Verified on this database:
--
--   select rolbypassrls from pg_roles where rolname = 'service_role';  -- t
--   select privilege_type from information_schema.role_table_grants
--    where grantee = 'service_role' and table_name = 'photos';
--     -> REFERENCES, TRIGGER, TRUNCATE. No SELECT, INSERT, UPDATE or DELETE.
--
-- So service_role skips RLS and is still subject to GRANT, exactly as the rule
-- in database.md says: GRANT decides whether a role may touch the table at all
-- and Postgres checks it first. Both Edge Functions failed with 42501
-- "permission denied for table photos" on their first real request.
--
-- config.toml leaves auto_expose_new_tables unset, which matches the current
-- cloud default of not auto-exposing new entities, so this reproduces in
-- production rather than being a local quirk.
--
-- Rule for new tables: if an Edge Function touches it, grant it here in the same
-- migration, next to the client grants.

-- ------------------------------------------------------------------ photos
-- request-photo-upload counts the profile's photos and inserts the reserved row.
-- moderate-photo reads the row and writes the verdict.
--
-- moderation_state is the only writable column. A function that could rewrite
-- r2_key or position could repoint a row at another user's object, and the
-- column list is what prevents it rather than review.

grant select, insert on photos to service_role;
grant update (moderation_state) on photos to service_role;

-- ----------------------------------------------------------- deleted_media
-- moderate-photo queues a rejected key. The purge job reads the queue and
-- stamps purged_at. Nothing needs to delete a row: the stamp is the record that
-- the object is gone, and losing it would mean purging twice or not at all.

grant select, insert on deleted_media to service_role;
grant update (purged_at) on deleted_media to service_role;

-- No grant on profiles. Setting photo_verified is service-role-only work, but
-- the verification flow does not exist yet and a privilege granted before it is
-- needed is a privilege nobody remembers to check.
