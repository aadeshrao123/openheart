# Setup

Versions are deliberately not pinned in this repo's docs. `expo install`
resolves the versions compatible with the current SDK - always let it decide
rather than copying numbers from a file that has gone stale.

## 1. Create the app shell

Run this in the repo root. It generates `package.json`, `app.json`,
`tsconfig.json`, `babel.config.js`, `metro.config.js` and the `app/` directory
with correct, current versions.

```bash
npx create-expo-app@latest . --template default
```

## 2. Install dependencies

```bash
npx expo install nativewind tailwindcss \
  react-native-reanimated \
  react-native-safe-area-context \
  react-native-screens \
  expo-image

npx expo install @supabase/supabase-js \
  @react-native-async-storage/async-storage \
  react-native-url-polyfill

npx expo install @tanstack/react-query zustand

npx expo install expo-localization i18next react-i18next

npx expo install expo-application

npm install clsx tailwind-merge
npm install -D prettier eslint
```

Add the `expo-localization` config plugin to `app.json` so the native projects
pick up locale handling:

```json
{ "expo": { "plugins": ["expo-localization"] } }
```

Then wire NativeWind following the current official setup guide (it touches
`babel.config.js`, `metro.config.js` and `global.css`) - the steps change
between majors, so read the guide rather than trusting a snippet.

## 3. Configure

```bash
cp .env.example .env
```

Fill in the Supabase URL/anon key and the Cloudflare image base URL.

## 4. Database

```bash
supabase start
supabase db push
supabase gen types typescript --local > lib/database.types.ts
supabase test db
```

`supabase test db` must pass before you push anything. It is the only thing
proving the RLS policies actually deny what they claim to deny.

## 5. Run

```bash
npx expo start
```

Press `i`, `a`, or `w`. All three must work - a change that only works on one
platform is not done.

## Verify the toolchain

```bash
npx expo-doctor
```
