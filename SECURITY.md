# Security Policy

OpenHeart is a dating app. The database holds approximate location, private
messages, and a record of who swiped which way on whom. A bug that exposes any
of that is not an inconvenience. It can put a real person in physical danger,
so it is handled privately and fixed before it is discussed in the open.

## Reporting a vulnerability

Report it through GitHub's private vulnerability reporting:

https://github.com/aadeshrao123/openheart/security/advisories/new

The same form is reachable from the repository's **Security** tab, under
**Report a vulnerability**. The report is visible only to you and the
maintainers, and you keep a credit on the resulting advisory unless you ask not
to be named.

**Do not open a public issue, pull request, or discussion for a vulnerability**,
and do not post it anywhere public until a fix has shipped. On this project a
public report is a working recipe for reading strangers' messages and locating
them, handed to everyone reading at once.

If the private reporting form is not available, open an issue containing
nothing but a request for a private channel. No details, no reproduction steps,
no affected table names.

## What matters most here

These four classes are the highest severity in this project. Anything that
falls into one of them is treated as critical, regardless of how much setup the
attack needs.

**1. Any Row Level Security bypass.** The client talks to Postgres directly
through the Supabase client, so RLS is not a layer of the security model, it is
the whole security model. Reading or writing a row you should not be able to
reach is a complete breach rather than a partial one. This class includes a
table shipped without policies, a policy that is broader than it looks, a
missing or over-broad grant, a `security definer` function with a mutable
`search_path`, and any RPC that returns rows the caller's own policies would
have denied.

**2. Any leak of precise location.** Coordinates are rounded to roughly 1km
before they are stored, and clients are meant to receive bucketed distances
only. Precise distances measured from a few vantage points trilaterate to a
home address. That is a documented attack against real dating apps that has
been used to locate real people, not a theoretical one. Anything that returns
raw coordinates, an unrounded distance, or a distance precise enough to
trilaterate belongs here, including a side channel such as a result set that
changes at an exact radius, an error message, or a measurable timing
difference.

**3. Any exposure of who swiped on whom.** `swipes` is the single most
sensitive table in the app. A user must never learn that another user liked or
passed on them, except through a mutual match. Anything that reveals the
direction of a swipe, or merely that a swipe exists, counts: a query that
returns another user's rows, a match trigger that can be probed, an ordering or
a count that shifts observably after someone swipes, or an error that differs
depending on whether a swipe is already recorded.

**4. Any way to see that you were blocked.** Blocking has to be invisible to
the blocked user, because a person who learns they were blocked frequently
escalates. Anything that distinguishes "blocked you" from "deactivated",
"deleted", or "out of range" counts: a different error code, a profile that
disappears in a distinguishable way, an insert that fails only for blocked
pairs, a notification that stops arriving, or a response that is measurably
slower.

Also serious, and worth reporting through the same route:

- A way to make a photo visible without passing moderation, or to read anything
  in the quarantine prefix.
- Account deletion that leaves personal data readable, or that lets a banned
  account shed its history and re-register clean.
- Bypassing the 18+ age gate, or editing a birthdate after signup.
- Anything that lets one account act as another, including token handling,
  signed upload URLs, and Edge Function authorization.
- Any exposure of a service-role key, or a path that reaches one from the
  client.
- Rate limit bypass on swipes or messages, which is harassment at scale.

## What to include in a report

- The commit or branch you tested.
- Steps to reproduce. A failing pgTAP test in `supabase/tests/` is the most
  useful report possible, because it becomes the regression test for the fix.
- Which class above it falls into, and what an attacker actually gets.
- Whether you found it locally or against a deployment.

## Testing safely

Test against your own local stack only:

```bash
supabase start
supabase db reset
supabase test db
```

Never test against another person's data or against a deployment you do not
own. Do not access, modify, or keep anyone else's account, messages, photos, or
location. If you hit real user data by accident, stop, say so in the report,
and delete what you collected.

## Supported versions

Pre-alpha. There are no releases yet, so the only supported version is the
current `main` branch. Once builds ship, support follows
`release_policy.minimum_supported_version` per platform: anything below that
gate is unsupported and the fix is to update.

## What to expect

This is a volunteer-run, donation-funded project. There is no bug bounty and no
payment, response times are best effort, and a fix lands as a normal pull
request with a test that proves the hole is closed. Coordinated disclosure is
the expectation: the advisory is published once the fix is in.
