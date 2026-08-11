# OpenHeart

A free, open source dating app for iOS, Android and web.

No paywalls. No boosts. No "see who liked you" upsell. Every feature is
available to every user, and hosting is funded by donations rather than by
charging lonely people for the ability to be seen.

**The rule that decides arguments:** if a feature exists to extract money from
someone who is lonely, it does not ship.

---

## Status

**Pre-alpha. Not usable yet.** The database layer is built and tested; the
application is not.

Done:

- Full schema with Row Level Security on every table
- PostGIS proximity matching
- Match creation as a database trigger, safe against concurrent swipes
- Account deletion that satisfies GDPR, trust and safety, and the other person
  in the conversation, all at once
- Minimum-supported-version gate and remote feature kill switches
- Design token system and the first UI primitives
- Localization and RTL support wired in from the first commit
- 15 pgTAP tests covering RLS policy denials and account lifecycle

Not done:

- The app itself. No screens, no navigation, no auth flow yet.
- Photo upload and the moderation pipeline
- Push notifications

## Stack

| Layer | Choice |
|---|---|
| App | Expo (React Native) + expo-router, one codebase for iOS, Android and web |
| Language | TypeScript, strict |
| UI | NativeWind, with semantic design tokens |
| Backend | Supabase: Postgres, Auth, Realtime, Edge Functions |
| Geo | PostGIS |
| Photos | Cloudflare R2 and Cloudflare Images |
| Localization | expo-localization, i18next, and the built-in `Intl` API |

There is no separate backend service. The client talks to Postgres directly and
Row Level Security is what makes that safe.

## Quick start

See [SETUP.md](SETUP.md) for the full walkthrough. The short version:

```bash
supabase start
supabase db reset
supabase test db
```

Everything after that is in SETUP.md, including creating the Expo app shell.

## Design principles

**Row Level Security is the entire security model.** The client has a direct
connection to the database, so a missing policy is a data breach rather than a
bug. Every table enables RLS in the same migration that creates it, and every
policy has a test proving it denies what it claims to deny.

**Invariants live in the database.** The age gate, location coarsening, match
creation and birthdate immutability are constraints and triggers, not
application code. Anything enforced only in the client can be bypassed by
anyone with the anon key and a terminal.

**Location is treated as radioactive.** Coordinates are rounded to roughly 1km
before they are stored, and clients receive bucketed distances, never precise
ones. Precise distances measured from several points trilaterate to a home
address. This is a documented attack against real dating apps, not a
theoretical one.

**Safety is not a later phase.** Reporting, blocking, photo moderation and an
18+ gate ship with v1 or the app does not launch.

**Nothing is guessed.** Versions, APIs and platform requirements are verified
against primary sources before they are written down. Where a non-obvious rule
came from a specific source, the source is cited in the code.

## Contributing

Contributions are welcome, including from people who have never shipped an app
before.

Project standards live in [CLAUDE.md](CLAUDE.md), which is the single document
describing how this codebase is meant to be written. Read it before your first
pull request. In short: no hardcoded colours, no hardcoded strings, RLS on
every table, and every policy gets a test.

`.claude/` is deliberately not tracked. Bring whatever tooling and editor
configuration you like; project standards that bind everyone live in
`CLAUDE.md` instead.

Before opening a pull request:

```bash
supabase test db
npx tsc --noEmit
```

## Licence

[AGPL-3.0](LICENSE). If you run a modified version as a service, you have to
publish your changes. That is intentional: the point is that nobody, including
a future version of this project, can take it closed and start charging for it.
