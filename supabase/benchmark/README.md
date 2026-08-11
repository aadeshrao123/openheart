# Discovery benchmark

**Local only. Never run `seed.sql` against a database that holds real accounts.**
It truncates `profiles` and everything that references it, then refills both
`profiles` and `swipes` with synthetic rows. There is no undo.

## What it answers

`discover_profiles` is a single query doing four things at once: a GiST radius
filter, an age range filter, an anti-join against `swipes`, and three permissive
RLS policies evaluated per candidate row (`profiles_select_own`,
`profiles_select_others`, which calls `is_blocked`, and
`profiles_select_match_member`, which scans `matches`). All four are free on a
few hundred profiles. This seed exists so the point where they stop being free
is a measured number and not an argument.

## What the seed creates

| | |
|---|---|
| Profiles | 100000, all `is_active` and `photo_verified` |
| Location | scattered over a 25km radius, denser toward the centre |
| Birthdates | spread across ages 18 to 59 |
| Swipes | roughly 4.96M |
| Swipe skew | most profiles swipe 15 to 55 times, every 100th swipes 1500 times |

The skew is the point. A flat swipe count per user benchmarks a user who does
not exist, and it is the heavy swiper whose anti-join against `swipes` is
expensive.

`photos`, `matches`, `messages`, `reports` and `blocks` are left empty. The
match trigger is disabled during the load, because running it once per swipe
would dominate the load time and matches are not what is being measured. So
this measures the discovery query and nothing else: it says nothing about the
deck's photo fetch, the chat list, or how `is_blocked` behaves once `blocks` is
large. An empty `matches` also makes `profiles_select_match_member` cheaper
here than in production, where it is a real lookup per candidate row.

Ids are deterministic: profile `n` is
`beefcafe-0000-4000-8000-<n in hex, zero padded to 12>`. Two useful samples:

- `beefcafe-0000-4000-8000-000000000000` heavy swiper, 1500 swipes
- `beefcafe-0000-4000-8000-000000000001` light swiper, 16 swipes

## The guard, and what it cannot see

`seed.sql` counts rows in `profiles` whose id does not carry the `beefcafe`
prefix and aborts if it finds any. A database with real signups therefore fails
closed on the first statement, before the truncate.

The blind spot: a production database whose `profiles` table happens to be
empty is indistinguishable, inside SQL, from a fresh local one. Nothing
reachable from a query reliably says "this is production". So check the
connection string by eye before you run it, and do not paste a pooler or
project host into these commands.

## Load it

The seed needs a database with the migrations applied and no data:

```bash
supabase start
supabase db reset
```

The scale is a psql variable and defaults to the 100000 the baseline was taken
at, so a plain run is unchanged. `-v scale=1000000` answers whether the timings
stay linear, which is a different question from whether they are acceptable.
The swipe distribution is per profile, so the swipe count scales with it and
1000000 profiles means roughly 50M swipes and about 10GB on disk. Check you
have the room first.

Then load it with `psql`:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 \
  -c '\timing on' \
  -f supabase/benchmark/seed.sql
```

That connection string is the local default from `supabase/config.toml`
(`[db] port = 54322`). If you changed the port, take the real one from
`supabase status -o env`.

Use `psql`, not `supabase db query --file`. Verified on CLI 2.109.0: that
command sends the file as a single prepared statement and fails with "cannot
insert multiple commands into a prepared statement" on any multi-statement
file.

The seed prints its own row counts when it finishes. `-c '\timing on'` prints
per-statement timings, so the load time of each insert is visible too. Record
the load time in the table below; a seed that suddenly takes twice as long is
itself a signal.

## Run the benchmark

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
begin;

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "beefcafe-0000-4000-8000-000000000000",
  "role": "authenticated"
}';

explain (analyze, buffers)
select * from discover_profiles(20);

rollback;
SQL
```

Swap the `sub` for `...000000000001` and run it again to get the light swiper.
Run each one three times and record the third: the first pays for a cold cache
and tells you about your disk, not about the query.

**`set local role authenticated` is not optional.** As `postgres` the policies
are bypassed entirely, and `is_blocked` never runs. The number you get is real
and also completely unlike what any user experiences.

## Reading the output

`discover_profiles` declares `set search_path = public`, and a SQL function
carrying a `SET` clause is not inlined by the planner. So the plan is a single
`Function Scan on discover_profiles` node with no internal detail. That is fine
for the number, which is what the table below tracks.

For the plan inside the function, copy the function body out of
`supabase/migrations/0003_matching.sql` and run it as an inline query in the
same impersonated transaction, substituting `page_size`. Copy it, do not retype
it, and do not paste a copy into this directory: a second copy of that query is
a second copy to keep in sync.

If the query is cancelled by `statement_timeout`, that is the result, not an
error to work around. The `authenticated` role carries `statement_timeout=8s`
on the local stack (`select unnest(rolconfig) from pg_roles where rolname =
'authenticated'`), and production carries one too. A discovery query that
exceeds it is a broken deck for every user on that path.

## Results

First baseline below, taken 2026-08-11. Read the note under it before comparing
anything to it: the machine was busy, so these are an upper bound rather than a
clean figure.

Record the third run, not the first. `Head` is the output of `git rev-parse
--short HEAD`, so a regression can be bisected.

| Date | Head | Profiles | Swipes | Sample user | Seed load | Exec ms | Buffers | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-08-11 | d8c47bc | 100000 | 4964937 | heavy | 173 s | 101 | 64102 | See note 1 |
| 2026-08-11 | d8c47bc | 100000 | 4964937 | light | 173 s | 92 | 64102 | See note 1 |
| 2026-08-11 | d8c47bc | 1000000 | 49649782 | heavy | 3350 s | 1154 | 553044/148023 | See note 2 |
| 2026-08-11 | d8c47bc | 1000000 | 49649782 | light | 3350 s | 961 | as above | See note 2 |

Note 1: 4 vCPU container, Postgres 17.6, `shared hit` only and no read, so the
whole working set was already in cache. The machine was not idle: language and
screen work was running in other processes, load average 1.3. Treat these as an
upper bound on this hardware rather than a clean figure, and re-baseline on a
quiet machine before comparing anything to them.

The inner plan confirms the GiST index is still the access path at 100k:

```
Index Scan using profiles_location_idx on profiles p
  Index Cond: (location && _st_expand(profiles.location, (max_distance_km * 1000)))
  Rows Removed by Filter: 17695
```

Note 2: 1M profiles and 49.6M swipes, 9.2GB on disk. Roughly 11x the 100k time
for 10x the profiles, so linear in the candidate set, and the GiST index is
still the access path:

```
Index Scan using profiles_location_idx on profiles p
  actual time=9.484..826.853 rows=58192
  Rows Removed by Filter: 175960
  Buffers: shared hit=87469 read=147964
```

Three things in that worth carrying forward.

The scan is 827ms of the 1154ms, and it stopped being a cache hit: 148k buffer
reads against zero at 100k. That is the actual change between the two rows, not
the row count.

The candidate set is 58192, exactly 10x the 5797 at 100k, because **this seed
scales density and not geography**. It scatters every profile over the same 25km
disc whatever the scale, so 1M means one metro with a million users in it rather
than a million users spread across cities. Real growth is the second shape, and
ST_DWithin bounds the candidate set by area, so it would look far more like the
100k row. Read the 1M row as "one very successful city", which is the
interesting question, but not as "the app has a million users".

A partial GiST index over the discoverability predicate was measured and does
NOT help. The planner used it, and `Rows Removed by Filter` stayed at exactly
175960, because this seed marks every profile `is_active` and `photo_verified`,
so that predicate excludes nothing. The rows being discarded are discarded by
the age range. Anyone optimising this should start there, and should first make
the seed's `photo_verified` distribution realistic, because in production that
column gates most profiles out and the benchmark currently understates its
selectivity.

Add a row per measurement rather than editing an old one. The history is the
whole value of the file; a table with one row in it answers nothing.

Things worth a note in the last column: Postgres major version, whether the
machine was otherwise idle, and any index added or removed since the previous
row. All three move the number more than most code changes do.

## Reproducibility

Locations come from `random()` after `setseed(0.4242)`, so reloading the seed on
the same Postgres build gives the same city twice. The sequence is not
guaranteed stable across Postgres major versions, so treat an upgrade as a
reason to re-baseline rather than to compare against older rows.

Everything else (ids, birthdates, swipe pairs) is pure arithmetic on the row
number and is identical everywhere.

## Clean up

```bash
supabase db reset
```

The schema does not change, so there is nothing to regenerate afterwards.
