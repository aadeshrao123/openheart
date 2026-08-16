# Setup

Versions are deliberately not pinned in this document. `package.json` is the
one place that records them, and `expo install` resolves anything new against
the current SDK - always let it decide rather than copying numbers out of a
file that has gone stale.

## Requirements

- Node, in the range `engines.node` in `package.json` declares
- Docker, for the local Supabase stack

The Supabase CLI is a dev dependency, so `npm ci` installs it and every command
below is `npx supabase`. That way everyone runs the version the lockfile pins
rather than whatever their machine happens to have.

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
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
npx supabase test db --local
```

`npx supabase status` prints the URL and anon key for `.env`.

`lib/database.types.ts` is generated and gitignored, so this step is not
optional: `npx tsc --noEmit` cannot resolve a single query without it.

`npx supabase test db` must pass before you push. It is the only thing proving the
RLS policies actually deny what they claim to deny.

If the discovery tests fail with a wildly wrong row count, the benchmark seed
is probably still loaded from a previous session. `npx supabase db reset` clears
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

## 5. Push notifications, if you are building Android natively

Only needed to build the Android app itself. `npx expo start` and the web build
do not touch any of this, and notifications on web are raised by the page and
need nothing here.

Android push goes through Firebase Cloud Messaging, because FCM is the only
route to a sleeping Android device. You need your own Firebase project:

1. Create a project at https://console.firebase.google.com. Turn Google
   Analytics off - nothing here uses it, and enabling it starts collecting data
   `docs/legal/store-data-disclosures.md` says this app does not collect.
2. Add an Android app with the package name from `app.json`, currently
   `org.openheartapp`. Leave the SHA-1 blank: it is only for Firebase Auth,
   which this app does not use, and leaving it out means push works on debug
   builds too.
3. Download `google-services.json` to the repository root. It is gitignored,
   for the reasons written next to that entry.
4. Skip the "Add Firebase SDK" Gradle instructions entirely. The
   `expo-notifications` config plugin writes all of it during prebuild, and
   following them by hand fights it.
5. Restrict the API key at
   https://console.cloud.google.com/apis/credentials to the Firebase
   Installations API and the FCM Registration API, which are the two Cloud
   Messaging needs.

Sending also needs an FCM V1 service account key, from Firebase project
settings, uploaded to the Expo project through `eas credentials` or the Expo
dashboard. That one is a real private key: it never goes in the repository, and
`*-service-account.json` is gitignored so a stray download in the tree cannot
be committed by accident.

Then:

```bash
npx expo prebuild --clean --platform android
npx expo run:android
```

A device rather than an emulator, unless the emulator image carries Google Play
services. FCM needs them, and without them the app runs and silently never gets
a token.

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
