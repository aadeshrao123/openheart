-- OpenHeart :: table privileges
--
-- RLS decides which ROWS a role may touch. GRANT decides whether the role may
-- touch the table at all, and it is checked first. A table with perfect
-- policies and no grant returns "permission denied" for every query.
--
-- Nothing here can be assumed from the platform. Verified on a clean database:
-- newly created tables in this project gave `authenticated` only Dxtm
-- (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) and no CRUD whatsoever. Every
-- privilege the client relies on is therefore granted explicitly below.
--
-- Column lists are the enforcement point for fields the client may read but
-- never write. Do not use REVOKE for that: revoking a column privilege the
-- role does not hold is a silent no-op, so the protection only looks real.
--
-- Rule for new tables: add its grants here in the same migration that creates
-- it, alongside its policies.

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------- profiles
-- birthdate is insertable but not updatable: the age gate is worthless if a
-- user can edit their way past it after signup.
-- photo_verified is the anti-bot gate and deleted_at is lifecycle state, so
-- neither is client-writable at all.

grant select on profiles to authenticated;

grant insert (
  id, display_name, birthdate, bio, gender, seeking,
  location, max_distance_km, age_min, age_max
) on profiles to authenticated;

grant update (
  display_name, bio, gender, seeking,
  location, max_distance_km, age_min, age_max,
  is_active, last_active
) on profiles to authenticated;

grant delete on profiles to authenticated;

-- ------------------------------------------------------------------ photos
-- moderation_state is the moderation verdict. Reordering is the only mutation
-- a client is allowed.

grant select on photos to authenticated;
grant insert (profile_id, r2_key, position) on photos to authenticated;
grant update (position) on photos to authenticated;
grant delete on photos to authenticated;

-- ------------------------------------------------------------------ swipes
-- No update or delete: a swipe is a historical fact.

grant select, insert on swipes to authenticated;

-- ----------------------------------------------------------------- matches
-- Rows are created by the match trigger. Unmatching is the only client write.

grant select on matches to authenticated;
grant update (unmatched_by) on matches to authenticated;

-- ---------------------------------------------------------------- messages
-- Marking as read is the only permitted mutation. Message bodies are immutable
-- so a conversation cannot be rewritten after the fact, which matters when a
-- thread is evidence in a report.

grant select on messages to authenticated;
grant insert (match_id, sender_id, body) on messages to authenticated;
grant update (read_at) on messages to authenticated;

-- ----------------------------------------------------------------- reports
-- SELECT and UPDATE are granted but gated to moderators by RLS. status is the
-- only field a moderator changes.

grant select on reports to authenticated;
grant insert (reporter_id, target_id, reason, detail) on reports to authenticated;
grant update (status) on reports to authenticated;

-- ------------------------------------------------------ blocks and hiding

grant select, insert, delete on blocks to authenticated;
grant select, insert, delete on hidden_matches to authenticated;

-- ---------------------------------------------------------- release policy
-- Readable before sign-in: the version gate runs on the launch screen, which
-- is reached before any session exists.

grant select on release_policy to anon, authenticated;

-- deleted_media is deliberately absent. It is drained by the service role,
-- which bypasses both grants and RLS. No client ever reads it.
