-- OpenHeart :: every table has RLS, without exception
--
-- CLAUDE.md: "Every table has RLS enabled. There are no exceptions and no
-- `using (true)` policies on user data. RLS is not a layer of the security
-- model, it is the whole security model. A missing policy is a data breach,
-- not a bug."
--
-- Every migration says `enable row level security` and nothing checked that all
-- of them did. This enumerates the schema instead of trusting the discipline,
-- so the table somebody adds in a hurry fails CI rather than leaking.
--
-- Supabase offers an event trigger that enables RLS on new tables
-- automatically. It is deliberately not used: postgis is installed into public
-- here, so the trigger would also fire on spatial_ref_sys, and RLS with no
-- policy on a table PostGIS reads is a broken matching query. A test cannot
-- break production; an event trigger can.

begin;
select plan(2);

-- Owned by the postgis extension rather than by this project. Anything else
-- appearing here is a table somebody forgot, which is the point.
create temporary table rls_exempt (name text) on commit drop;
insert into rls_exempt values ('spatial_ref_sys');

select is(
  (
    select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
       and c.relname not in (select name from rls_exempt)
  ),
  '',
  'every table in public has row level security enabled'
);

-- Enabled is not the same as enforced. A table owner bypasses RLS unless the
-- table also forces it, and these are owned by postgres, so the policies are
-- what stands between a client and the rows.
select ok(
  (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
  ) >= 12,
  'and the count is the whole schema, not a handful of tables'
);

select * from finish();
rollback;
