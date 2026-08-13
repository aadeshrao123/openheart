# Client Compatibility and Lifecycle Rules

A shipped mobile client never dies. Some users never update, the App Store
rollback story is "submit a new build and wait for review", and a bad release
reaches phones you cannot reach back. Everything here exists because it cannot
be added retroactively to clients already installed.

---

## The schema is a public API

Once a version ships, every column it reads is a contract you cannot break.

**Never, on a table or view a shipped client reads:**

- drop a column
- rename a column
- narrow a type
- add a `not null` column without a default
- change the meaning of an existing value

**Always safe:**

- add a nullable column
- add a column with a default
- add a table
- add an enum value, provided old clients treat unknown values as a fallback
  rather than crashing

Renaming is a three-release sequence, not an edit: add the new column and write
to both, ship a client reading the new one, then drop the old one only once
telemetry shows no client on the old version is still active.

## Deprecate by version, not by date

Before removing anything, raise `minimum_supported_version` in
`release_policy`, ship it, and wait. The gate is what makes removal safe.
Removing on a calendar date removes it for users who never saw the prompt.

## Every response tolerates unknown fields

Clients ignore JSON keys they do not recognise. This is what lets the server
ship a field before any client uses it. Never write parsing that rejects an
unexpected key.

## Feature flags fail open

An unknown flag defaults to enabled, and an unreachable `release_policy`
defaults to "you are current". A server outage must not brick installed apps,
and a client older than a flag must keep behaving exactly as it did the day it
shipped.

The kill switch exists to disable a feature that is actively broken. It is not
a configuration system and it is not a substitute for shipping a fix.

---

## Account deletion is anonymization, not a row delete

Three requirements conflict under a hard delete:

- GDPR requires the personal data to actually be erased.
- Trust and safety requires reports about an abuser to survive their account
  deletion. Otherwise deleting and re-registering wipes the evidence trail,
  which is the standard ban-evasion move.
- The other participant in a conversation must not watch their chat history
  silently vanish. Those messages are their data too.

Keeping the row and destroying its contents satisfies all three. `deleted_at`
is set, the personal fields are cleared, photos are queued for purge from
object storage, and the id survives as a pseudonymous handle for abuse
prevention.

Consequences that must hold:

- A deleted profile is never discoverable. Enforced by `is_active = false` plus
  a check constraint, not by client filtering.
- Match participants can always read each other's profile row so the UI can
  render a deleted-account state rather than a blank screen.
- The surviving participant keeps the conversation and removes it themselves
  through `hidden_matches`. Hiding is per user: neither side can erase the
  other's copy.

Deleting rows from object storage is not something Postgres can do, so orphaned
keys go into `deleted_media` and a scheduled function drains the queue. A
deleted account whose photos are still fetchable by anyone holding the URL has
not actually been deleted.

## Birthdate is immutable after signup

The age check fires on insert and update, but nothing stopped the update
itself. A user could sign up at 25 and edit down to 17, or edit up to escape an
age restriction. Set once, changed only through support.

Treat any field the safety model depends on the same way. If a value gates
access, the user must not be able to rewrite it freely.

## Media has exactly one path to visibility

The client never writes to a public bucket. The only route is:

1. client requests a signed upload URL from an Edge Function
2. the object lands in a private quarantine prefix
3. the scan runs and sets `moderation_state`
4. only `approved` objects are readable, enforced by RLS

Shipping "upload now, scan later" means every existing photo is unscanned and
its public URL is already distributed. The retrofit is a full backfill plus a
key rotation, which is why this cannot be deferred past the first commit.

## One auth identity per account

No automatic merging on matching email addresses. Sign in with Apple issues
relay addresses through Hide My Email, so the same person can legitimately
present two different addresses, and two different people can share one.
Automatic merging on email would eventually join two strangers' accounts.

Linking a second sign-in method is an explicit action in settings, taken by a
user who is already authenticated.

---

## Before removing anything

1. Is any shipped client reading it? Check version telemetry, not intuition.
2. Has `minimum_supported_version` been raised past every version that reads it?
3. Has that gate been live long enough for users to actually update?

If you cannot answer all three with evidence, the removal waits.
