-- OpenHeart :: close the hard delete on profiles
--
-- Verified against this database before the migration was written. An ordinary
-- authenticated client, holding nothing but the public anon key and its own
-- JWT, could run
--
--   delete from profiles where id = <its own id>
--
-- and it succeeded. authenticated held a table-level DELETE grant from 0006 and
-- profiles_delete_own permitted the row, so both layers agreed.
--
-- Every foreign key pointing at profiles is ON DELETE CASCADE, so that one
-- statement also removed:
--
--   reports.target_id   every report ever filed against them
--   blocks.blocked_id   every block anyone had placed on them
--   matches, messages, message_reactions, swipes, photos
--
-- Measured in a rolled-back transaction: one report and one block against the
-- account, then a single delete as that account, then zero of each. The user is
-- then free to register the same address again with no history. That is exactly
-- the ban-evasion move the whole account-deletion design exists to prevent, and
-- it bypassed it in one request.
--
-- Nothing legitimate used it. delete_my_account() is security definer and
-- anonymises with an update; the only row it deletes is auth.users, and
-- profiles has no foreign key to auth.users, so the tombstone survives. The app
-- has never issued a delete against this table.
--
-- Both layers are closed rather than one. A revoke is the right tool here and
-- not the no-op the grants rule warns about, because the privilege was actually
-- held: confirmed in information_schema.role_table_grants before writing this.

revoke delete on public.profiles from authenticated;

drop policy if exists profiles_delete_own on public.profiles;
