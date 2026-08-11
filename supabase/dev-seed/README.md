# Development deck seed

**Local only.** This writes `photo_verified = true`, which is the anti-bot gate
and has deliberately no grant for any client role. Nothing in the application
can set it, and `supabase/tests/service_role_grants.test.sql` asserts that even
the service role cannot. The seed runs as `postgres`, which is exactly why it
must never be pointed at a database holding real accounts.

`discover_profiles` requires a candidate to be `photo_verified`, so without this
the deck is empty by construction and Phase 4 cannot be looked at.

## What it creates

Profiles with ids prefixed `deadbeef-`, all `is_active` and `photo_verified`,
scattered within a few kilometres of a point you choose, with ages spread across
the range and `last_active` staggered so the deck ordering is visible.

It touches nothing else. There is no blanket `update profiles set
photo_verified = true`, on purpose: a seed that can promote a real account is a
seed that eventually will.

## Find your own coordinates first

Candidates only appear if they are inside your own `max_distance_km`, so they
have to be seeded near wherever the app put you.

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -tAc \
  "select ST_Y(location::geometry) || ' ' || ST_X(location::geometry)
     from profiles where deleted_at is null and location is not null
    order by created_at desc limit 1;"
```

That prints `latitude longitude`. If it prints nothing, open the app and grant
the location permission: your own profile has no location yet, and
`ST_DWithin` against a null location returns no rows.

## Load it

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 -v lat=51.5074 -v lon=-0.1278 -v count=25 \
  -f supabase/dev-seed/seed.sql
```

## Clear it before running the tests

`supabase test db` runs against this same database, and `discovery.test.sql`
asserts an exact candidate count. With the seed loaded it fails with
`have: 26, want: 1`, which looks like a broken policy and is not. The benchmark
seed has the identical trap. Clear the seed, then run the tests.

## Clear it

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "delete from profiles where id::text like 'deadbeef-%';
   delete from auth.users where id::text like 'deadbeef-%';"
```

Seeded profiles have no photos, because no photo can reach `approved` until a
CSAM provider exists. The deck renders its no-photo state for all of them.
