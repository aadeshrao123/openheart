# Setup

Versions are deliberately not pinned in this document. `package.json` is the
one place that records them, and `expo install` resolves anything new against
the current SDK - always let it decide rather than copying numbers out of a
file that has gone stale.

## Requirements

- Node, in the range `engines.node` in `package.json` declares
- Docker, for the local Supabase stack
- The Supabase CLI

## 1. Install dependencies

The app shell already exists, so there is no `create-expo-app` step. Installing
from the lockfile is the whole of it:

```bash
npm ci
```

Use `npx expo install <package>` rather than `npm install` when adding anything
new. It resolves the version that matches the Expo SDK, which hand-picking
does not, and the mismatch usually surfaces at runtime on one platform only.

## 2. Configure

```bash
cp .env.example .env
```

Fill in the Supabase URL and anon key from step 3, plus the Cloudflare image
base URL. The app throws on startup if the first two are missing, which is
deliberate: a half-configured client that silently fails at the first query is
worse than one that refuses to boot.

## 3. Database

```bash
supabase start
supabase db reset
supabase gen types typescript --local > lib/database.types.ts
supabase test db --local
```

`supabase status` prints the URL and anon key for `.env`.

`lib/database.types.ts` is generated and gitignored, so this step is not
optional: `npx tsc --noEmit` cannot resolve a single query without it.

`supabase test db` must pass before you push. It is the only thing proving the
RLS policies actually deny what they claim to deny.

If the discovery tests fail with a wildly wrong row count, the benchmark seed
is probably still loaded from a previous session. `supabase db reset` clears
it; see `supabase/benchmark/README.md`.

`supabase db reset` restarts the containers but does not re-read
`supabase/config.toml`. After changing anything under `[auth]`, including the
email templates, run `supabase stop && supabase start` or the old config stays
live. The symptom is a sign-in email arriving with the subject "Your sign-in
link" instead of a code.

## 4. Run

```bash
npx expo start
```

Press `i`, `a`, or `w`. All three must work - a change that works on one
platform is not finished.

## Before pushing

```bash
npm run lint
npm run typecheck
npm test
supabase test db --local
```

CI runs all four, plus the ASCII and 100-column style invariants.

## Verify the toolchain

```bash
npx expo-doctor
```
