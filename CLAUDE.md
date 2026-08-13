# OpenHeart

Free, open source dating app. iOS, Android, and web from one codebase.
Funded by donations, never by paywalls, boosts, or "see who liked you" gates.

**The rule that decides arguments:** if a feature exists to extract money from a
lonely person, it does not ship. Every feature is available to every user.

## Detailed rules

Read the relevant file before writing code. These are binding, not advisory.

| File | Covers |
|---|---|
| `docs/rules/coding-style.md` | formatting, comments, naming, no em dashes, ASCII only |
| `docs/rules/typescript-react.md` | TS strictness, component tiers, styling tokens, data layer |
| `docs/rules/database.md` | migrations, RLS policy form, security definer, invariants |
| `docs/rules/localization.md` | translation keys, plurals, RTL layout, Intl formatting |
| `docs/rules/client-compatibility.md` | schema as API, version gate, deletion, media |
| `docs/rules/verification.md` | no guessing: verify versions and APIs against primary sources |
| `docs/rules/git.md` | commit messages, what never gets pushed, history rewriting |

These lived in `.claude/` until they did not, which was a bug: `.claude/` is
gitignored, so a fresh clone got this table insisting the rules were binding and
none of the files it named. Tooling and agent configuration still belong there
and still are not tracked. Anything that binds every contributor is in `docs/`.

`docs/README.md` is the index, and also covers the legal drafts and the prepared
store privacy answers.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| App | Expo (React Native) + expo-router | One codebase -> iOS, Android, web |
| Language | TypeScript, strict mode | No `any`. No JS files. |
| UI | NativeWind | Tailwind classes -> native styles + web CSS |
| Server state | TanStack Query | All Supabase reads go through it |
| Client state | Zustand | UI-only state. Never mirror server data here. |
| Backend | Supabase | Postgres + Auth + Realtime + Edge Functions |
| Geo | PostGIS | `geography(point,4326)`, GiST index |
| Photos | Cloudflare R2 + Cloudflare Images | R2 has zero egress fees. This is the cost decision. |
| Push | Expo Notifications | Wraps APNs + FCM |
| Chat | Supabase Realtime | Postgres Changes, so RLS is the authorization |
| Auth | Email magic link, Sign in with Apple, Google | No SMS - see Cost rules |
| Web host | Cloudflare Pages | Expo web static export |
| Localization | expo-localization + i18next + react-i18next | device locale, string resolution |
| Formatting | built-in `Intl` | dates, numbers, units. No date library. |
| Errors | Sentry | |
| Builds | EAS Build | |
| CI | GitHub Actions | |
| License | AGPLv3 | |

### Versions

Pin the current latest at install time. Do **not** copy version numbers out of
this file or from memory - check first:

```bash
npm view expo version && npm view nativewind version && npx expo-doctor
```

Expo SDK upgrades are the one upgrade that matters; follow the official upgrade
guide for that release rather than bumping `expo` by hand. Everything else:
stay current, upgrade in its own PR, never mixed with feature work.

### Deliberately not used

Redis, microservices, a separate API server, GraphQL, ML ranking,
an exotic database, a state management library beyond the two above.

Adding any of these requires a profiler output showing the current approach is
the bottleneck. "It will scale better" is not a reason. At 50k users this app
does roughly 30 writes/sec average - Postgres is not going to be the problem.

---

## Architecture

There is **no backend service**. The Expo client talks to Postgres directly
through the Supabase client, and Row Level Security is what makes that safe.

Edge Functions exist only for things the client must not be trusted with:

- issuing signed R2 upload URLs
- running photo moderation on upload
- sending push notifications
- anything touching a service-role key

If you are about to write an Edge Function that just reads or writes a table,
stop - that is a query plus an RLS policy.

### Schema

```
profiles   id(->auth.users) display_name birthdate bio gender seeking
           location(geography) max_distance_km age_min age_max
           is_active last_active photo_verified
photos     id profile_id r2_key position is_nsfw_checked
swipes     swiper_id target_id direction created_at   PK(swiper_id,target_id)
matches    id user_a user_b created_at unmatched_by
messages   id match_id sender_id body created_at delivered_at read_at deleted_at
message_reactions message_id user_id reaction     PK(message_id,user_id)
reports    id reporter_id target_id reason status created_at match_id evidence
           moderator_note resolved_by resolved_at
blocks     blocker_id blocked_id                      PK(blocker_id,blocked_id)
```

Migrations live in `supabase/migrations/`, applied via `supabase db push`.
Never edit the schema through the dashboard - it will not be in git and the
next contributor will not have it.

### Security model

**Every table has RLS enabled. There are no exceptions and no `using (true)`
policies on user data.** RLS is not a layer of the security model, it is the
whole security model. A missing policy is a data breach, not a bug.

Baseline policies:

- A profile is readable only if neither party has blocked the other.
- `messages` are readable only by the two users in that `match_id`.
- `swipes` are readable only by their author. Never expose who swiped which way
  on whom - that is the single most sensitive table in the app.
- `reports` are insert-only for users; readable only by moderators.

Every new table gets policies in the same migration that creates it.

### Location privacy

Round coordinates to ~1km before writing to `profiles.location`. Never send
another user's coordinates to a client - send a computed distance only, and
round it ("3 km away", not "3.12 km"). Trilateration from precise distances is
a real attack that has been used to locate real people. Treat exact location as
radioactive.

### Matching

One query, no service layer:

```sql
select * from profiles p
where ST_DWithin(p.location, $me_location, $max_distance_km * 1000)
  and p.id != $me and p.is_active and p.photo_verified
  and extract(year from age(p.birthdate)) between $age_min and $age_max
  and not exists (select 1 from swipes  where swiper_id = $me and target_id = p.id)
  and not exists (select 1 from blocks
                  where (blocker_id,blocked_id) in (($me,p.id),(p.id,$me)))
order by p.last_active desc
limit 20;
```

Match creation is a **Postgres trigger** on `swipes`, not client code: on a
right-swipe, look for a reciprocal right-swipe, insert into `matches`, queue a
push. The database owns this so two simultaneous swipes cannot race into a
duplicate or missing match.

---

## Layout

```
app/                  routes (expo-router, file-based). Screens only.
components/ui/        design-system primitives. Reusable, domain-free.
components/           feature components, composed from ui/. Domain-aware.
hooks/                data hooks. One per resource. All Supabase calls live here.
lib/                  supabase client, generated types, i18n, formatting, helpers
locales/              translation bundles, one JSON per language
supabase/migrations/  schema + RLS. The source of truth.
supabase/tests/       pgTAP. Policy tests.
supabase/functions/   Edge Functions. The only place a service-role key exists.
infra/                Cloudflare config, applied by wrangler. Never by dashboard.
global.css            <- every colour in the app is defined here
tailwind.config.js    <- every token *name* is defined here
```

## Theming - one place, everywhere

**Colours are never written in a component.** Not hex, not `rgb()`, not a
Tailwind palette name like `pink-500`. Components use semantic token classes
only: `bg-brand`, `text-fg-muted`, `border-border`, `bg-danger-subtle`.

The chain is: `global.css` holds the actual RGB values (light and dark) ->
`tailwind.config.js` gives them semantic names -> components use the names.

To restyle the entire product across light mode, dark mode, iOS, Android and
web, you edit **`global.css` and nothing else.** That is the whole point. If a
colour change ever requires touching more than one file, a token is missing -
add the token, don't hardcode the value.

Token names describe **purpose, not appearance**. `--brand`, never `--pink`.
`--danger`, never `--red`. Renaming `--pink` to `--blue` on rebrand day just
relocates the problem.

The same applies to type (`text-title`, `text-body`), radii (`rounded-card`,
`rounded-control`) and spacing. Raw values like `text-[17px]` or `rounded-2xl`
in a component are the same bug as a hex code.

## Localization

Every user-visible string is translatable from the first commit, including
accessibility labels, placeholders, and error text. Retrofitting i18n means
touching every screen twice, and RTL cannot be bolted on at all without a full
visual pass.

```tsx
const { t } = useTranslation();
<Text>{t('matches.new_match', { name })}</Text>
```

Three rules that cause permanent damage if broken early:

- **Never assemble a sentence from fragments.** Word order differs by language.
  Interpolate into a complete string the translator controls.
- **Never branch on count.** `t('matches.count', { count })` with `_one` and
  `_other` keys. A ternary is wrong in every language with more than two plural
  forms.
- **Never use `pl-`, `pr-`, `ml-`, `mr-`, `text-left`, or `text-right`.** Use
  the logical equivalents `ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`.
  RTL follows `I18nManager` automatically, but only if layout is written in
  start/end terms.

Dates, numbers, distances, and relative times go through `lib/format.ts`, which
wraps `Intl`. Never hand-write a format string. Distance is metric or imperial
by region, so a user in the US sees miles.

Adding a language is two steps: a new JSON in `locales/`, and two lines in
`lib/i18n.ts`. If it ever requires editing a component, that component has a
hardcoded string.

Full rules in `docs/rules/localization.md`.

## Shipped clients never die

Some users never update, and a bad release sits on phones you cannot reach. Two
things exist in v1 because they cannot be added retroactively: a
`minimum_supported_version` gate and per-feature kill switches, both in the
`release_policy` table and read on launch by `useReleasePolicy`.

Consequences that bind every schema change:

- **The schema is a public API.** Never drop, rename, or narrow a column a
  shipped client reads. Adding a nullable column is always safe. Renaming is a
  three-release sequence, never an edit.
- **Deprecate by version, not by date.** Raise the minimum version, ship it,
  wait for telemetry, then remove.
- **Fail open.** An unknown feature flag is enabled and an unreachable policy
  means "you are current". A server outage must never brick installed apps.

## Account deletion is anonymization

Hard deletion cannot satisfy GDPR, trust and safety, and the other participant
in a conversation at the same time. `delete_my_account()` clears the personal
fields, queues photos for purge from R2, ends open matches, and keeps the row
so foreign keys, message history and reports survive. Otherwise deleting and
re-registering erases the evidence trail, which is the standard ban-evasion
move.

The surviving participant keeps their conversation and removes it on their own
terms through `hidden_matches`, which is per user. Neither side can erase the
other's copy.

Birthdate is immutable after signup. Any field the safety model depends on gets
the same treatment.

## Media has one path to visibility

Signed URL from an Edge Function, private quarantine prefix, scan, then
`approved`. The client never writes to a public bucket. "Upload now, scan
later" means a full backfill and key rotation to fix, which is why it cannot be
deferred.

Full rules in `docs/rules/client-compatibility.md`.

## Blocking has to reach every table

Blocking someone you were already matched with did nothing until 0014: no
policy on `messages` or `matches` consulted `blocks`, so a blocked person could
keep messaging. A safety control that only covers the path you thought of is
worse than none, because the user stops taking other precautions.

A block closes the match by setting `unmatched_by` to the blocker, which is
indistinguishable from an unmatch. Never give the blocked person a signal:
losing the conversation history would be one, so it stays.

Moderators have no blanket read on `messages`. A reporter submits a snapshot of
what they are reporting, and that is the only conversation content a moderator
ever sees. `suspended_at` is in no grant and a trigger refuses reactivation,
because `is_active` is client-writable and always will be.

## Chat is never deleted, only blanked

Supabase documents that RLS is **not** applied to `DELETE` events in Postgres
Changes, because Postgres cannot check access to a row that no longer exists, so
a delete reaches every subscriber of the table. Everything in chat is therefore
an insert or an update: unsending blanks the body and keeps the row, and
clearing a reaction sets it to null rather than removing it.

Receipts and unsend are RPCs and `messages` carries no update grant. A column
grant cannot express "only while unread" or "never backwards".

A channel must be given a JWT before it subscribes. supabase-js pushes one on
auth state change, but a subscription that beats it is authorized as anonymous,
matches no rows, and then silently receives nothing rather than failing.

## Component rules

There are two kinds of component and they do not mix:

- **`components/ui/`** - primitives. Know nothing about dating, profiles or
  matches. `Button`, `Text`, `Card`, `Avatar`, `Screen`. Reusable in any app.
- **`components/`** - feature components. Compose primitives, know the domain.
  `ProfileCard`, `SwipeDeck`, `MessageBubble`. Never re-implement a primitive.

Rules that keep it modular:

- **Nothing imports `Text`, `Pressable`, or `View`-with-styling from
  `react-native` directly.** Use the primitive. If the primitive can't do it,
  add a variant to the primitive - that is how the design system grows.
- **Variants are objects, not props sprawl.** A new button look is a new key in
  the `variants` map in `button.tsx`, not a `isOutlinedSecondary` boolean.
- **Every primitive takes `className`** and merges it with `cn()` so callers can
  adjust spacing without a new variant.
- **Screens contain no business logic.** A screen composes components and calls
  a hook. If a screen has a `supabase.from(...)` call in it, that belongs in
  `hooks/`.
- **A component used twice gets extracted.** Not three times. Twice.

## Conventions

- Files `kebab-case.tsx`, components `PascalCase`, hooks `use-thing.ts`.
- Imports use the `@/` alias. No `../../../`.
- **Regenerate DB types after every migration**: `supabase gen types typescript`
  -> `lib/database.types.ts`. Never hand-write a row type; never edit that file.
- Styling is NativeWind `className` only. No `StyleSheet.create`, no inline
  style objects, no styled-components.
- Every screen must work on iOS, Android and web. Platform-specific code goes in
  `.ios.tsx` / `.android.tsx` / `.web.tsx` files, not `Platform.OS` branches
  scattered through a component.
- Server data is TanStack Query, always. Never `useEffect` + `useState` around a
  Supabase call. Zustand is for UI state only and never mirrors server data.
- Every interactive element needs `accessibilityRole` and an accessible label.
  This is not optional polish.

## Testing

Not every function needs a test. These do, and breaking them without a failing
test first is not acceptable:

- the candidate/matching query
- the match trigger
- every RLS policy (test as an unauthorized user, assert zero rows)
- block and report behaviour

Vitest for logic, `supabase test db` (pgTAP) for policies and triggers.

---

## Non-negotiables

These are not features to prioritize later. They ship with v1 or the app does
not launch.

**Safety.** Report, block, and unmatch, reachable from every profile and every
chat. A moderation queue a human actually reads. Automated nudity and CSAM
scanning on every upload *before* the photo is visible to anyone. Rate limits
on swipes and messages.

**Age.** 18+ only, gated at signup, App Store rating 18+. No ambiguity here.

**Account deletion.** In-app, real, cascading. Apple requires it, GDPR requires
it, and it is simply correct. "Deactivate" is not deletion.

**Photo verification** before a profile enters anyone's deck. A pose-match
selfie. This one rule kills most bot and spam traffic, which is the failure
mode that has killed every previous free dating app.

## Cost rules

Hosting is donation-funded. The budget is real and small.

- **R2, never S3.** Egress fees on photo delivery are the entire bill in this
  category. Zero-egress is why R2 is chosen.
- **Resize on upload.** Never serve an original camera image. Target ~200KB.
- **No SMS auth.** ~$0.01-0.05 per message and it is the standard way a free app
  quietly goes bankrupt. Email and OAuth only.
- Donations go through the website (GitHub Sponsors / Open Collective), never
  in-app - Apple rejects in-app donation links.
- No IAP anywhere, which also means no 30% platform cut.

Migration path: Supabase Cloud Pro (~$25/mo) -> self-hosted Supabase on a
Hetzner dedicated box (~EUR 45/mo) when the bill passes ~$80/mo. Same Postgres,
same client SDK, so this is a connection-string change and not a rewrite. When
one box is genuinely saturated: read replica, then pgBouncer. Do not shard.

---

## Commands

First-time setup is in `SETUP.md`. Day to day:

```bash
npx expo start                # dev server; press i / a / w
supabase start                # local Postgres + auth
supabase db push              # apply migrations
supabase gen types typescript --local > lib/database.types.ts
supabase test db              # RLS policy tests - must pass
npm run lint && npx tsc --noEmit
npx expo-doctor               # verify toolchain versions
eas build --profile preview --platform all
```

## Launch strategy

The hardest problem here is not technical. A dating app with 40 users in a city
is useless to all 40 of them. Launch in **one city**, invite-gated, and do not
expand until density is real. Shipping wide and empty kills the project.
