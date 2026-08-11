# Benchmark results

Recorded by loading supabase/benchmark/seed.sql then running EXPLAIN ANALYZE on
discover_profiles. Re-run and add a row whenever the query changes.

Environment: local Supabase, Postgres in Docker on a developer workstation.
Absolute numbers are not comparable to production. The shape of the plan is.

| Date | Migration | Profiles | Swipes | Rows | Execution | Shared buffers |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: |
| 2026-08-11 | 0007 | 100,000 | 4,964,937 | 20 | 559 to 1112 ms | 404,229 |
| 2026-08-11 | 0008 | 100,000 | 4,964,937 | 20 | 58 ms | 42,231 |

## What the first measurement showed

The anti-join against swipes was not the bottleneck, which contradicted the
assumption the schema was designed around. It resolved through swipes_pkey as
an index-only scan in roughly a microsecond per candidate.

The cost was Row Level Security on profiles, evaluated once per candidate row.
Postgres ORs permissive policies together, so each row paid for all three:

- profiles_select_others calls is_blocked() per row
- profiles_select_match_member runs an EXISTS against matches per row

profiles_select_match_member exists only so a match participant can see a
deleted account in their chat. It is irrelevant to discovery, but the planner
cannot know that, so adding it in 0004 quietly made every profile read in the
application more expensive.

Cost scaled with profile count, not with swipe volume.

## What 0008 changed

1. discover_profiles became security definer, so the policies are no longer
   re-evaluated per row. The authorization it had been relying on is written
   out explicitly in the function body as a single set-based anti-join against
   blocks.
2. The age filter compares birthdate against a date range instead of computing
   extract(year from age(birthdate)) per row, which was not sargable.

Result: 58 ms, a 10 to 19 times improvement, and roughly a tenth of the buffer
traffic.

## The cost of that change

RLS no longer protects the rows discover_profiles returns. The block check, the
active check, the verified check and the deleted check are now ordinary
predicates. A careless edit could drop one and no policy would catch it.

supabase/tests/discovery.test.sql covers each exclusion independently, in both
block directions. Any change to discover_profiles adds a case there first.

## Still open

Not yet measured: behaviour at 1M profiles, and whether the geo index remains
the right access path when the candidate set within max_distance_km grows past
a few tens of thousands. Do not assume this scales linearly. Re-measure.
