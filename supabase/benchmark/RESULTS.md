# Benchmark results

Recorded by running supabase/benchmark/seed.sql then EXPLAIN ANALYZE on the
discover_profiles body. Re-run and add a row whenever the query changes.

| Date | Profiles | Swipes | Rows returned | Execution |
| :--- | ---: | ---: | ---: | ---: |
| 2026-08-11 | 100,000 | 4,964,937 | 20 | 559 ms to 1112 ms |

Environment: local Supabase, Postgres in Docker on a developer workstation.
Absolute numbers are not comparable to production. The shape of the plan is.

## What the plan showed

The anti-join against swipes was NOT the bottleneck. It resolved through
swipes_pkey as an index-only scan, roughly 0.001 ms per candidate.

The cost came from Row Level Security on profiles being evaluated per candidate
row. Two policies are responsible:

- profiles_select_others calls is_blocked() once per row
- profiles_select_match_member runs an EXISTS against matches once per row

404,229 shared buffer hits to return 20 rows.

## What this means

At 100k profiles the discovery query is already too slow for an interactive
deck, and it degrades with profile count rather than with swipe count. The
earlier assumption that the swipes table would be the first wall was wrong.

Options, none yet implemented, in rough order of preference:

1. Make discover_profiles security definer and perform the block and activity
   filtering explicitly inside the function body, so the policies are not
   re-evaluated per row. This moves a safety check from a declarative policy
   into function code, so it needs its own tests before it ships.
2. Narrow the candidate set before the policies run, for example by applying
   the geo and age filters in a subquery over a table the policies do not
   guard.
3. Materialise a per-user candidate pool on a schedule.

Do not act on this without re-measuring. One benchmark on one machine is a
starting point, not a mandate.
