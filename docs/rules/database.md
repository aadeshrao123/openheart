# Database and RLS Rules

The client talks to Postgres directly. Row Level Security is not one layer of
the security model, it is the entire security model. A missing policy is a data
breach, not a bug.

---

## Migrations

### The schema lives in `supabase/migrations/` and nowhere else

Never change the schema through the Supabase dashboard. A dashboard change is
absent from git, absent from every other contributor's machine, and absent from
production until someone remembers it.

### Every table enables RLS in the same migration that creates it

Not a follow-up migration. The same file. A table that exists for even one
deploy without policies is a table that was readable by everyone.

### Regenerate types after every migration

```bash
supabase gen types typescript --local > lib/database.types.ts
```

### Migrations are append-only

Never edit a migration that has been applied anywhere but your own machine.
Write a new one.

---

## GRANT is checked before RLS

RLS decides which *rows* a role may touch. GRANT decides whether it may touch
the table at all, and Postgres checks it first. A table with flawless policies
and no grant returns "permission denied" for every query.

Never assume the platform grants anything. Verified on a clean database in this
project: newly created public tables gave `authenticated` only `Dxtm`
(TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) and no CRUD at all. Every privilege
the client depends on is granted explicitly in `0006_grants.sql`.

A new table adds its grants in the same migration that creates it, next to its
policies.

### Restrict writable fields with a column GRANT, never a REVOKE

```sql
-- Wrong: if the role never held table-level UPDATE, this is a silent no-op and
-- only looks like protection.
revoke update (photo_verified) on profiles from authenticated;

-- Right: the column list is the whitelist.
grant update (display_name, bio, location) on profiles to authenticated;
```

Fields the safety model depends on stay out of the list. `photo_verified` is
the anti-bot gate, `birthdate` is the age gate, `moderation_state` is the
moderation verdict. A user who can write any of them has defeated that control.

## Writing policies

### Wrap `auth.uid()` and other stable functions in a `select`

This is a correctness-adjacent performance rule, not a micro-optimization. A
bare function call in a policy is evaluated once per row. Wrapping it in a
`select` makes the planner treat it as an initPlan and evaluate it once for the
whole query.

```sql
-- Bad: auth.uid() runs for every row scanned
using (auth.uid() = profile_id)

-- Good: evaluated once
using ((select auth.uid()) = profile_id)
```

Source:
https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

This is only valid for functions whose result does not depend on the row, which
covers `auth.uid()`, `auth.jwt()`, and security-definer helpers that take no
row-dependent arguments.

### Index every column a policy filters on

A B-tree index on the column compared against `auth.uid()` is the single largest
win available, and it only pays off in combination with the wrapped-select form
above.

### Always specify `to authenticated`

```sql
create policy profiles_select_own on profiles
  for select to authenticated
  using ((select auth.uid()) = id);
```

Without the role, the policy is also evaluated for anonymous requests that can
never satisfy it, which is wasted work on every query.

### One policy per operation, never `for all`

Separate `select`, `insert`, `update`, and `delete` policies. `for all` hides
which operation a `using` clause is actually guarding and makes review harder.

### `using` versus `with check`

- `using` filters which existing rows the statement can see or touch.
- `with check` validates the rows being written.

An `update` policy needs both. Omitting `with check` lets a user modify a row
they legitimately see into a state they should not be able to create, such as
reassigning it to another owner.

### Never write `using (true)` on user data

If a table genuinely has public rows, say so explicitly with the real condition.

### Revoke columns users must not write

Column-level grants are the right tool for fields the client can read but never
set:

```sql
revoke update (photo_verified) on profiles from authenticated;
```

A user who can verify their own photos has defeated the anti-bot system.

---

## Security definer functions

Use them only to break policy recursion, such as a helper that reads `blocks`
from inside a policy on `profiles`.

Every security definer function pins its search path:

```sql
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ ... $$;
```

A security definer function without `set search_path` is a privilege escalation
hole: a caller can create a shadowing object in a schema earlier on the path and
have it run with the definer's rights.

Prefer `security invoker` for anything that does not strictly need elevation.
The discovery RPC is invoker precisely so RLS still applies to its results.

---

## Invariants belong in the database

Anything that must always be true is enforced by a constraint or a trigger, not
by application code. Client code can be bypassed by anyone with the anon key and
a terminal.

- Age gate: trigger on `profiles`, because `CHECK` cannot call `current_date`.
- Location coarsening: trigger, so precise coordinates never land in the table
  and therefore can never leak from it.
- Match creation: trigger on `swipes`, so simultaneous mutual likes cannot race
  into a duplicate or a missing match.
- Canonical ordering (`user_a < user_b`) plus a unique constraint, so the
  database does the deduplication rather than application logic.

---

## Testing

`supabase test db` must pass before anything is pushed.

Tests assert the negative case. A policy that wrongly grants access looks fine
in the app and is invisible until it is a headline. Every policy gets a test
proving that a user who should not see a row does not see it.

The two most sensitive tables in this project:

- `swipes`, because it reveals who is interested in whom.
- `blocks`, because a user must never learn that they were blocked.

Both have explicit tests asserting zero rows for an unauthorized caller.

---

## Privacy

Precise location never leaves the database, and never enters it either.
Coordinates are rounded before storage, and only bucketed distances are
returned to clients. Precise distances measured from several points trilaterate
to a home address, which is a documented real-world attack against dating apps,
not a theoretical one.
