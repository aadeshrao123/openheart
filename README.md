<div align="center">

# OpenHeart

**A free, open source dating app for iOS, Android and web.**

No paywalls. No boosts. No super likes.<br>
No "someone liked you, pay to find out who".

[![Licence][badge-licence]](LICENSE)
[![Status][badge-status]](#status)
[![Platforms][badge-platforms]](#stack)
[![Contributions][badge-contrib]](#contributing)

[badge-licence]: https://img.shields.io/badge/licence-AGPL--3.0-3178c6?style=flat-square
[badge-status]: https://img.shields.io/badge/status-pre--alpha-e9a23b?style=flat-square
[badge-platforms]: https://img.shields.io/badge/platforms-iOS_Android_Web-6e6e80?style=flat-square
[badge-contrib]: https://img.shields.io/badge/contributions-welcome-2ea043?style=flat-square

</div>

---

## Why this exists

Every big dating app has the same conflict of interest, and once you see it you
cannot unsee it:

> **A user who finds a partner stops paying.**

That single fact shapes everything those products do. Their revenue does not
come from you finding someone. It comes from you staying, scrolling, and buying
one more thing that promises to work slightly better than the last one. Super
likes. Boosts. Priority placement. See-who-liked-you. Rewinds. Read receipts.
Every one of them is sold as help and priced as hope.

An app that genuinely matched you with the right person on day three would be a
terrible business. So none of them are built that way, and it would be strange
to expect otherwise. The incentives are simply pointed somewhere else.

The problem is not that these companies are villains. It is that loneliness
turned out to be an excellent thing to sell against, and people who are lonely
will keep paying. That is the part worth objecting to.

OpenHeart has no revenue, so it has no reason to keep you here. If you meet
someone and delete the app the same week, the project worked exactly as
intended. That is the entire design goal, and it is only achievable because
nobody is trying to make money from it.

## Nothing is hidden

Closed dating apps ask you to trust an algorithm you are not allowed to see,
one that decides who you meet and who you never will. You cannot check whether
it quietly deprioritises you, or whether the people it shows you are the ones
it thinks will keep you subscribed.

Here, matching is a single SQL function you can read in about a minute:
[`discover_profiles`](supabase/migrations/0003_matching.sql).

It finds people who are:

- inside your distance range
- inside your age range
- not someone you have already swiped on
- not someone who blocked you, and not someone you blocked

ordered by who was recently active. That is all of it. No hidden score, no
desirability ranking, no paid tier jumping the queue, because there is no paid
tier.

If you think it should work differently, you can read it, argue about it in an
issue, and change it. That is a real option here and it is not one anywhere
else.

## What this is for

Finding your person. That is it.

The world got lonelier, the apps built to fix it learned that lonely people
convert well, and somewhere in there the actual point got lost. This is an
attempt to build the thing that was supposed to exist in the first place: a way
to meet someone, that costs nothing, that nobody profits from, and that you can
inspect all the way down.

---

## Status

> **Pre-alpha. Not usable yet.** The database layer is built and tested.
> The app is not.

**Done**

- Full schema with Row Level Security on every table
- PostGIS proximity matching
- Match creation as a database trigger, safe against concurrent swipes
- Account deletion that satisfies GDPR, trust and safety, and the other person
  in the conversation, all at once
- Minimum-supported-version gate and remote feature kill switches
- Design token system and the first UI primitives
- Localization and right-to-left layout support from the first commit
- 15 pgTAP tests covering policy denials and account lifecycle

**Not done**

- The app itself. No screens, no navigation, no sign-in flow yet.
- Photo upload and the moderation pipeline
- Push notifications

Contributors are very welcome, including people who have never shipped an app
before.

## Stack

| Layer | Choice |
| :--- | :--- |
| **App** | Expo (React Native) and expo-router, one codebase for all platforms |
| **Language** | TypeScript, strict |
| **UI** | NativeWind, with semantic design tokens |
| **Backend** | Supabase: Postgres, Auth, Realtime, Edge Functions |
| **Geo** | PostGIS |
| **Photos** | Cloudflare R2 and Cloudflare Images |
| **Localization** | expo-localization, i18next, and the built-in `Intl` API |

There is no separate backend service. The client talks to Postgres directly,
and Row Level Security is what makes that safe.

## Quick start

Full walkthrough in [SETUP.md](SETUP.md). The short version:

```bash
supabase start
supabase db reset
supabase test db
```

## How it is built

**Row Level Security is the entire security model.**
The client holds a direct connection to the database, so a missing policy is a
data breach rather than a bug. Every table enables RLS in the same migration
that creates it, and every policy has a test proving it denies what it claims
to deny.

**Invariants live in the database.**
The age gate, location rounding, match creation and birthdate immutability are
constraints and triggers, not application code. Anything enforced only in the
client can be bypassed by anyone with the public key and a terminal.

**Location is treated as radioactive.**
Coordinates are rounded to roughly one kilometre before they are stored, and
the app only ever receives bucketed distances. Precise distances measured from
a few points can be used to calculate someone's home address. That is a
documented attack against real dating apps, not a hypothetical one.

**Nobody can see who liked you, including us.**
There is deliberately no way to query it. That is the exact data every paid app
sells back to its users, and storing it behind a policy that could be relaxed
later is not good enough.

**Safety is not a later phase.**
Reporting, blocking, photo moderation and an 18+ gate ship with version one or
the app does not launch.

**Nothing is guessed.**
Versions, APIs and platform requirements get verified against primary sources
before they are written down. Where a non-obvious rule came from a specific
source, that source is cited in the code next to it.

## Contributing

Project standards live in [CLAUDE.md](CLAUDE.md). Read it before your first
pull request. In short: no hardcoded colours, no hardcoded strings, RLS and
grants on every table, and every policy gets a test.

Before opening a pull request:

```bash
supabase test db
npx tsc --noEmit
```

## Money

Hosting costs real money and donations pay for it. Nothing is ever sold inside
the app, no feature is ever gated, and no donor gets anything a non-donor does
not. If donations dry up entirely, the code is still yours to self-host, which
is the point of the licence.

## Licence

[AGPL-3.0](LICENSE). If you run a modified version as a service, you have to
publish your changes.

That is deliberate. It means nobody can take this, close it, add a paywall and
sell it back to the people it was built for. Not another company, and not a
future version of this project either.

<div align="center">
<br>
<sub>Built so that it can be given away.</sub>
</div>
