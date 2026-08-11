-- OpenHeart :: repair account deletion
--
-- Two defects found by running 0004 against a real database. Both are silent
-- in a migration that applies cleanly, which is why they only surfaced under
-- execution.

-- ------------------------------------------------- the cascade defeated it
--
-- profiles.id referenced auth.users(id) ON DELETE CASCADE, so the final
-- `delete from auth.users` in delete_my_account() destroyed the very row the
-- anonymization had just created. Verified: the profile row count went to zero
-- and every report, message and match referencing it cascaded away with it.
--
-- Dropping the constraint is what makes the tombstone possible. Integrity at
-- signup is preserved by the RLS insert policy, which already requires
-- id = auth.uid(), so a client still cannot invent a profile for someone else.

alter table profiles
  drop constraint profiles_id_fkey;

-- ------------------------------------------- the anonymized name was illegal
--
-- display_name carried CHECK (char_length between 1 and 40), so writing '' to
-- erase it raised a constraint violation and the whole deletion aborted.
--
-- The empty name is now legal only for a deleted profile, which also means a
-- live profile can never have a blank name by accident.

alter table profiles
  drop constraint profiles_display_name_check;

alter table profiles
  add constraint display_name_valid check (
    case
      when deleted_at is null then char_length(display_name) between 1 and 40
      else display_name = ''
    end
  );

-- Clients must render the deleted state from deleted_at, never by testing for
-- an empty name.
