-- OpenHeart :: narrow the read grant on profiles to the columns another person
-- is allowed to see
--
-- RLS decides which ROWS a role may read. The GRANT decides which COLUMNS, and
-- 0006 granted the whole table. So every row a policy let you read handed over
-- every column with it, including location and birthdate.
--
-- Verified against this database before this migration was written, in a
-- transaction that was rolled back. Ana and Ben swipe right on each other, the
-- trigger in 0003 creates the match, and then, as Ana:
--
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub": "<ana>", "role": "authenticated"}';
--
--   select display_name, birthdate,
--          ST_Y(location::geometry) as latitude,
--          ST_X(location::geometry) as longitude
--     from profiles where id = '<ben>';
--
--    display_name | birthdate  | latitude | longitude
--   --------------+------------+----------+-----------
--    Ben          | 1988-11-23 |    51.51 |     -0.09
--
-- The coordinates are rounded to about 1km by the round_location trigger in
-- 0001, so this is not the trilateration attack the design rules out. It is
-- still the neighbourhood someone sleeps in, plus an exact date of birth, and
-- the onboarding copy tells the user their date of birth is shown to nobody.
--
-- Narrowing a column is normally forbidden here: the schema is a public API and
-- a shipped client that reads a column it can no longer read breaks on a phone
-- nobody can reach. Nothing is shipped yet. Doing this after launch would cost
-- a three-release deprecation, which is exactly why it is done now.

-- ------------------------------------------------------------------- grant
--
-- REVOKE is the right tool here rather than the silent no-op the note in 0006
-- warns about, because the privilege is actually held: confirmed in
-- information_schema.column_privileges, which lists SELECT on all 17 columns
-- for authenticated, before this ran.

revoke select on public.profiles from authenticated;

-- Everything one person legitimately reads off another person's row. Four
-- columns are deliberately absent:
--
--   birthdate         personal data, and promised to nobody. Age is what the
--                     product renders, and the database computes it:
--                     discover_profiles since 0003, match_age below.
--   location          a home neighbourhood. Discovery already returns a 5km
--                     distance bucket instead and never a coordinate.
--   suspended_at      moderation state. Your own comes back through
--   suspended_reason  my_profile(); nobody else's is anyone's business.
--
-- id and is_active stay readable because photos_select_others reads them from
-- inside its own policy, and a policy that reaches into another table is
-- checked with the caller's privileges. That is the same reason is_blocked is
-- security definer.

grant select (
  id, display_name, bio, gender, seeking,
  max_distance_km, age_min, age_max,
  is_active, photo_verified, last_active, created_at, deleted_at
) on public.profiles to authenticated;

-- ------------------------------------------------------------ your own row
--
-- A column grant applies to your own row too, so `select *` on yourself is now
-- refused exactly like anyone else's, and the client needs a supported way back
-- to its own birthdate, location and suspension state.
--
-- security definer, so it does not need the grant it exists to work around.
-- This is not a second way to read a profile: the only row it can return is the
-- caller's, the predicate is the entire function body, and auth.uid() is null
-- for an anonymous request, which matches nothing. Execute is granted to
-- authenticated only, so anon cannot call it at all.

create or replace function public.my_profile()
returns setof profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from profiles where id = (select auth.uid());
$$;

revoke all on function public.my_profile() from public;
grant execute on function public.my_profile() to authenticated;

-- ----------------------------------------------------- the other person's age
--
-- Age is what a profile shows, not a date of birth, and discover_profiles has
-- computed it in the database since 0003. Same expression here, so a candidate
-- in the deck and the same person once matched cannot disagree by a day.
--
-- The gate is the rule the profiles_select_match_member policy in 0004 already
-- states: the two of you appear on one match row. Nothing else, and in
-- particular not a block: that policy survives a block on purpose, because an
-- age that disappears is a signal to the blocked person that they were blocked.
--
-- Returns null rather than raising for a stranger, so it cannot be used to
-- enumerate who exists.

create or replace function public.match_age(target uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select extract(year from age(p.birthdate))::int
    from profiles p
   where p.id = target
     and (select auth.uid()) <> target
     and exists (
       select 1
         from matches m
        where (select auth.uid()) in (m.user_a, m.user_b)
          and target in (m.user_a, m.user_b)
     );
$$;

revoke all on function public.match_age(uuid) from public;
grant execute on function public.match_age(uuid) to authenticated;
