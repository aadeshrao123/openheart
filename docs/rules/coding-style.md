# Coding Style Rules

Write code that is easy to read, easy to debug, and looks like a human wrote it.
Prioritize clarity over cleverness.

---

## Characters

### Never use em dashes or en dashes

Not in code, not in comments, not in documentation, not in commit messages, not
in UI copy. Use a regular hyphen, a comma, a colon, or start a new sentence.

Bad, with U+2014 EM DASH and U+2013 EN DASH where the markers are. This file is
held to the rule it describes, so the characters are named rather than printed,
the same way `lib/locales.test.ts` writes them as escapes:

```ts
// Load the profile <U+2014> then hydrate the deck
const MAX_PHOTOS = 6; // hard limit <U+2013> enforced by the DB too
```

Good:

```ts
// Load the profile, then hydrate the deck
const MAX_PHOTOS = 6; // hard limit, enforced by the DB too
```

The same applies to curly quotes, ellipsis characters, and arrows. Type `"`,
`...` and `->`. ASCII only in source files.

CI enforces this repository-wide with a `git grep` for any byte outside
`[:print:]` and `[:space:]` in the C locale, which is exactly "not ASCII".
`locales/*.json` is the only exemption, and it has to be: a translation cannot
be written without the letters of its own language.

### No emoji anywhere in source

Not in comments, not in log lines, not in commit messages. UI strings that
genuinely need a pictogram use an icon component.

---

## Comments

Comments are expensive. Every one is a line that can go stale and lie to the
next reader. Write few, and make each one earn its place.

### Explain WHY, never WHAT

Bad:

```ts
// Set the page size to 20
const pageSize = 20;
```

Good:

```ts
// 20 fills roughly three screens of the deck, so the next fetch starts before
// the user reaches the end.
const pageSize = 20;
```

### Do not comment obvious code

Bad:

```ts
// Get the current user
const user = await getUser();
```

Good:

```ts
const user = await getUser();
```

### Comment non-obvious decisions, constraints, and workarounds

These are the comments worth writing:

```ts
// Rounded to 5km. Precise distances from a few vantage points trilaterate to
// a home address.
const bucket = Math.round(distanceKm / 5) * 5;
```

```sql
-- Wrapped in a select so the planner caches the result as an initPlan instead
-- of calling auth.uid() once per row.
using ((select auth.uid()) = id)
```

### Never leave commented-out code

Delete it. Git has the history.

### No banner comments or decorative separators inside functions

A function that needs section headers is a function that should be three
functions.

---

## Formatting

### Never cram logic onto one line

Bad:

```ts
if (user && user.isActive) { markSeen(user); count += 1; }
```

Good:

```ts
if (user && user.isActive) {
  markSeen(user);
  count += 1;
}
```

### Single-statement bodies still get braces

Bad:

```ts
if (!session) return null;
```

Good:

```ts
if (!session) {
  return null;
}
```

The exception is a guard clause at the very top of a function, where the
one-line form is idiomatic in TypeScript and stays readable:

```ts
export function photoUrl(key: string): string {
  if (!key) throw new Error('photoUrl requires a key');
  ...
}
```

Pick one form per file and hold it.

### One statement per line

Bad:

```ts
let x = 0; let y = 0; let z = 0;
```

Good:

```ts
let x = 0;
let y = 0;
let z = 0;
```

### Keep lines under 100 characters

Exempt: `locales/*.json`. A translation string cannot be wrapped without
changing its value, and German or Finnish copy routinely runs 30% longer than
the English it was measured against. Enforcing a column limit there would push
translators toward worse copy.

Also exempt: generated files. `supabase/config.toml` and
`lib/database.types.ts` are written by tooling and are overwritten on the next
run, so editing them to satisfy a style rule accomplishes nothing.


Break long calls so each argument is scannable and independently
breakpointable:

Bad:

```ts
const { data } = await supabase.from('profiles').select('id, bio').eq('is_active', true).limit(20);
```

Good:

```ts
const { data, error } = await supabase
  .from('profiles')
  .select('id, display_name, bio, birthdate')
  .eq('is_active', true)
  .order('last_active', { ascending: false })
  .limit(20);
```

### Separate logical blocks with blank lines

```ts
export async function submitSwipe(targetId: string, direction: SwipeDirection) {
  const userId = await requireUserId();

  const { error } = await supabase.from('swipes').insert({
    swiper_id: userId,
    target_id: targetId,
    direction,
  });

  if (error) {
    throw error;
  }
}
```

---

## Naming

### Descriptive, not verbose

```ts
const p;                                    // too short, meaningless
const currentUserProfileDataObject;         // reads like a sentence
const profile;                              // right
```

### Booleans read as questions

```ts
const isActive = true;      // good
const hasPhotos = true;     // good
const canMessage = true;    // good
const active = true;        // acceptable but weaker
```

### Do not abbreviate

`profile` not `prof`, `message` not `msg`, `distance` not `dist`. The exceptions
are terms that are already universal in this domain: `id`, `url`, `db`, `rls`.

---

## Functions

### One job each

If a function does fetching and transforming and rendering, it is three
functions.

### Early returns instead of nesting

Bad:

```ts
function process(profile: Profile | null) {
  if (profile) {
    if (profile.isActive) {
      if (profile.photoVerified) {
        // logic buried three levels deep
      }
    }
  }
}
```

Good:

```ts
function process(profile: Profile | null) {
  if (!profile) {
    return;
  }

  if (!profile.isActive || !profile.photoVerified) {
    return;
  }

  // logic at the top level
}
```

### Use intermediate variables for complex expressions

Bad, and impossible to inspect in a debugger:

```ts
setDeck(data.filter((p) => !seen.has(p.id)).sort((a, b) => b.score - a.score).slice(0, 20));
```

Good:

```ts
const unseen = data.filter((profile) => !seen.has(profile.id));
const ranked = unseen.sort((a, b) => b.score - a.score);

setDeck(ranked.slice(0, 20));
```

### Keep ternaries to one level

```ts
const label = isMatch ? 'Matched' : 'Pending';   // fine

const label = isMatch ? (isNew ? 'New match' : 'Matched') : 'Pending';   // bad
```

Nested ternaries become `if` / `else`.

### Do not over-abstract

Extract a function when the same logic appears a second time. A helper called
from exactly one place should be inlined.

---

## Consistency

Within a single file, keep brace style, indentation, comment density, and
parameter ordering identical throughout. Slight variation between files is
normal and expected in a real codebase.
