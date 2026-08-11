# Contributing

Contributions are welcome, including from people who have never shipped an app
before. The project is pre-alpha: the database layer is built and tested, the
application is not, so almost everything is still ground floor.

Before your first pull request, read [CLAUDE.md](CLAUDE.md). It is the single
document describing how this codebase is meant to be written, and it is binding
rather than advisory. This file is the short version plus the mechanics.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## What gets accepted

The rule that decides arguments: if a feature exists to extract money from
someone who is lonely, it does not ship. No paywalls, no boosts, no "see who
liked you" gate, no visibility that can be bought. Every feature is available
to every user. Everything outside that is open for discussion, and opening an
issue first is cheaper than writing code nobody merges.

Safety, localization and Row Level Security are not later phases. A pull
request that adds a table without a policy, or a screen with an English string
baked into it, gets sent back before the rest of it is reviewed.

## Local setup

[SETUP.md](SETUP.md) is the full walkthrough: creating the Expo app shell,
installing dependencies, starting Supabase, and generating types.

Do not copy version numbers out of any document in this repository. `expo
install` resolves the versions that match the current SDK, and a hand-picked
version breaks React Native builds in ways that surface at runtime on one
platform only.

Day to day, once the shell exists:

```bash
supabase start
supabase db reset
supabase test db
npx expo start
```

## Before you open a pull request

Both of these must pass:

```bash
supabase test db      # RLS policies actually deny what they claim to deny
npx tsc --noEmit      # types actually compile
```

Run them, do not assume them. A change is done when it has been executed, not
when it has been written, so paste the output into the pull request rather than
reporting that it worked.

If your change touches a screen, it has to work on iOS, Android and web. One
platform is not finished.

## Database changes

Every new table gets four things, and the first three land in the same
migration that creates the table:

1. **RLS enabled.** `alter table <name> enable row level security;` A table
   that exists for even one deploy without policies was readable by everyone,
   which is why a follow-up migration is not good enough.
2. **Policies.** One per operation, never `for all`. Always `to authenticated`.
   `auth.uid()` wrapped in a `select` so the planner evaluates it once instead
   of once per row. Never `using (true)` on user data. An `update` policy needs
   both `using` and `with check`.
3. **Grants.** RLS decides which rows a role may touch, GRANT decides whether
   it may touch the table at all, and Postgres checks the grant first. A table
   with perfect policies and no grant returns "permission denied" for every
   query. Use a column list as the whitelist for what the client may write, and
   keep fields the safety model depends on out of it. Never use `revoke` for
   that: revoking a privilege the role never held is a silent no-op that only
   looks like protection.
4. **A policy test** in `supabase/tests/`, in the same pull request. It asserts
   the negative case: a user who should not see a row gets zero rows. A policy
   that wrongly grants access looks fine in the app and stays invisible until
   it is a headline.

Migrations are append-only. Never edit one that has been applied anywhere but
your own machine, and never change the schema through the Supabase dashboard,
because that change is absent from git and from every other contributor's
machine.

Regenerate the types after every migration:

```bash
supabase gen types typescript --local > lib/database.types.ts
```

That file is generated and gitignored. Never hand-write a database row type.

The schema is a public API. Once a version ships, do not drop, rename or narrow
a column that a shipped client reads. Adding a nullable column is always safe.

## Colours and strings

Two rules a reviewer checks first, because both are close to unfixable in bulk
later.

**No hardcoded colours, sizes or radii.** Not hex, not `rgb()`, not a Tailwind
palette name like `pink-500`, not an arbitrary value like `text-[17px]`. Values
live in `global.css`, names live in `tailwind.config.js`, and components use
the semantic token:

```tsx
<View className="bg-brand rounded-card p-4" />      // good
<View className="bg-[#E94A6E] rounded-[20px]" />    // bad
```

Restyling the entire product across light mode, dark mode, iOS, Android and web
is meant to be a one-file diff, and that only holds if the rule holds without
exception. A value with no token means the token is missing: add it. Token
names describe purpose, not appearance, so `--brand` and never `--pink`.

**No hardcoded user-visible strings.** Every string a user can read comes from
a translation key, including accessibility labels, placeholders, error text and
empty states. Those are the ones that get missed.

```tsx
<Text>{t('matches.new_match', { name })}</Text>
<Text>{t('matches.count', { count })}</Text>
```

Never assemble a sentence from fragments and never branch on count. Word order
and plural rules differ per language, so a ternary is wrong in every language
with more than two plural forms.

Layout uses logical properties so RTL works: `ps-`, `pe-`, `ms-`, `me-`,
`text-start`, `text-end`. Never `pl-`, `pr-`, `ml-`, `mr-`, `text-left` or
`text-right`.

Log lines, errors thrown for developers and test fixtures are not user-visible
and do not need keys.

## Your tooling is yours

`.claude/` is gitignored on purpose. Bring whatever editor, agent, and rule
files you like, and do not commit them. Standards that bind everyone live in
`CLAUDE.md`, which is tracked. A pull request that imposes one contributor's
local tooling on everybody else will be asked to drop it.

## Style

ASCII only in source files. No em dashes, no en dashes, no curly quotes, no
arrows, no emoji, in code, comments, documentation or commit messages. Type
`"`, `...` and `->`. Keep lines under 100 characters.

Comments explain why, never what, and there should be few of them. Named
exports only, no default exports. `any` is banned, use `unknown` and narrow it.
Files are `kebab-case.tsx`, components are `PascalCase`, hooks are
`use-thing.ts`. Imports use the `@/` alias, never `../../../`.

Server data goes through TanStack Query and every Supabase call lives in
`hooks/`. A screen that contains `supabase.from(...)` is misplaced.

Nothing is guessed. Verify a version number, an API signature, a config key or
a platform rule against the tool itself, the installed source in
`node_modules/`, or the official documentation for the version in use. If you
could not verify something, say so plainly in the pull request. An unverified
assumption that is labelled is a task. One presented as fact is a bug with a
delay fuse.

## Pull requests

- One change per pull request. Dependency upgrades get their own and are never
  mixed with feature work.
- Say what changed and why, and paste the output of the two commands above.
- Breaking something that has a test means fixing the code, not the test.
- Draft pull requests are welcome. So is an unfinished branch with a question.

## Security issues

Do not open a public issue for a vulnerability. [SECURITY.md](SECURITY.md) has
the private reporting route and describes which classes matter most here.

## Licence

Contributions are licensed under [AGPL-3.0](LICENSE), the same as the project.
Nobody, including a future version of this project, can take it closed and
start charging for it.
