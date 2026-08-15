# Edge Functions

Edge Functions exist only for the things the client must not be trusted with.
Everything else is a query plus an RLS policy. These two exist because signing
an R2 upload URL needs a secret, and because `photos.moderation_state` is not
in the client's column grant in `0006_grants.sql` and never will be.

| Function | Purpose |
|---|---|
| `request-photo-upload` | Reserves a slot, issues a presigned PUT into quarantine |
| `moderate-photo` | Scans the uploaded object and writes the verdict |
| `purge-deleted-media` | Drains the `deleted_media` queue out of R2 |

Shared code lives in `_shared/` and is bundled into each function that imports
it. It is not deployable on its own.

---

## The upload flow

1. **Client asks for a slot.** `POST /functions/v1/request-photo-upload` with
   the user's session JWT on `Authorization` and `{ "position": 0 }` in the
   body. Position is the ordering slot on the profile grid, 0 to 5.

2. **The function authenticates and validates.** The caller is resolved with
   `auth.getUser(token)`, which asks the Auth server rather than decoding the
   token locally. The position must be an integer in range, and the profile
   must hold fewer than six photos.

3. **A row is reserved.** The `photos` row is inserted with a fresh
   `quarantine/<uuid>` key and `moderation_state = 'pending'` **before** the URL
   is signed. The unique `(profile_id, position)` constraint is what actually
   settles two concurrent requests for the same slot; the count check only
   exists to return `photo_limit_reached` instead of a constraint error.

4. **A presigned PUT comes back.** Response body:

   ```json
   {
     "photo_id": "uuid",
     "r2_key": "quarantine/uuid",
     "upload_url": "https://<account>.r2.cloudflarestorage.com/...",
     "expires_in": 300
   }
   ```

5. **The client PUTs the bytes straight to R2.** It never touches a public
   bucket, and the app's own servers never carry the image payload.

6. **Client asks for the scan.** `POST /functions/v1/moderate-photo` with
   `{ "photo_id": "..." }`. The function re-authenticates, loads the row scoped
   to the caller's own `profile_id`, fetches the object back out of R2 with a
   SigV4-signed GET, and checks the leading bytes are a real JPEG, PNG or WebP.

7. **The verdict is written by the service role.** `approved` makes the photo
   visible through `photos_select_others`. `rejected` queues the key into
   `deleted_media` for the purge job **first**, then writes the verdict, so a
   crash between the two leaves a retryable pending row rather than an orphaned
   object in quarantine.

A photo is only ever scanned once. Re-running a completed verdict would let a
caller retry until a probabilistic classifier gave the answer they wanted, so a
non-pending row is returned as-is.

### Error codes

The body is always `{ "error": "<code>" }` with a stable machine code. The
client maps the code to a translation key, so no user-visible copy lives here.

| Code | Status | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing or invalid `Authorization` |
| `invalid_position` | 400 | Not an integer in 0 to 5 |
| `invalid_photo_id` | 400 | Missing or non-string `photo_id` |
| `photo_limit_reached` | 409 | Profile already holds six photos |
| `position_taken` | 409 | Another request won that slot |
| `photo_not_found` | 404 | No such photo owned by this caller |
| `object_not_uploaded` | 409 | The PUT never completed |
| `moderation_unavailable` | 503 | Scanner or R2 unreachable, row left pending |
| `internal_error` | 500 | Unhandled, see the function logs |

A missing object comes back from R2 as a 404 and maps to `object_not_uploaded`.
An unreachable bucket makes `fetch` throw instead, which is a different
situation: retryable, and reported as `moderation_unavailable` so the client
knows that. The row stays pending either way.

---

## Secrets

Injected by the platform, nothing to set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The docs list `SUPABASE_SERVICE_ROLE_KEY` under "legacy keys". It is still
populated, and its format is unambiguous, which is why it is used here rather
than the current `SUPABASE_SECRET_KEYS` dictionary. Re-check before relying on
it long term.
https://supabase.com/docs/guides/functions/secrets

Set by hand, once per project:

| Secret | Where it comes from |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare dashboard, R2 overview |
| `R2_BUCKET` | The bucket holding `quarantine/`. See `infra/README.md`. |
| `R2_ACCESS_KEY_ID` | R2 API token, scoped to that one bucket |
| `R2_SECRET_ACCESS_KEY` | Same token |
| `PURGE_TOKEN` | Any long random string you generate. See below. |
| `AWS_REGION` | Where Rekognition is called. See `infra/README.md`. |
| `AWS_ACCESS_KEY_ID` | The `openheart-moderation` IAM user, not root. |
| `AWS_SECRET_ACCESS_KEY` | Same user. |
| `ARACHNID_SHIELD_USERNAME` | Arachnid Shield API credentials, free. See below. |
| `ARACHNID_SHIELD_PASSWORD` | Same credentials. |

## The two scanners, and what they do not cover

`createModerationProvider` composes both and requires both. Rekognition answers
"is this explicit". Arachnid Shield, run by the Canadian Centre for Child
Protection, answers "is this a known image" by matching against their hash list.
Constructing either one reads its credentials, so a missing secret throws before
any photo is scanned and `moderate-photo` answers 503 with the row still
pending. That is deliberate: a photo checked for one thing and not the other
must not reach `approved`.

Neither answers "is this abuse material nobody has catalogued yet". Hash
matching only ever finds what is already on the list, and Rekognition is the
wrong tool entirely. Closing that gap needs a classifier, and the two that exist
(Thorn Safer, Google Content Safety API) both require qualifying as a partner.
Worth knowing before anyone describes this as complete coverage.

Credentials are free and a signup rather than an application:
https://projectarachnid.ca/en/contact/

Their `test` classification exists so the wiring can be proved end to end
without anyone handling real material, and it is treated as a rejection, which
is the only way that proof means anything.

**Not answered by any of this:** a hit obliges preserving the object and filing
a report, which the REPORT Act extended to a year, and that contradicts the
`deleted_media` purge path. This code has no reporting route, so a match today
rejects the photo and tells nobody. That is a legal question, and it is the last
thing standing between here and photos actually going live.

`purge-deleted-media` takes no user JWT: nothing about it is per user and it must
not be callable by whoever happens to be signed in. It compares an
`X-Purge-Token` header against `PURGE_TOKEN` at full length, so the comparison
cannot be timed.

`PURGE_TOKEN` is the one secret that lives in three places rather than two, and
the third is easy to miss. The workflow in `.github/workflows/purge-media.yml`
sends it, so it is also a repository secret in GitHub, and it has to be the same
value as the one this project holds. Set both together, never one at a time:

```bash
T=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
supabase secrets set "PURGE_TOKEN=$T"
gh secret set PURGE_TOKEN --body "$T"
unset T
```

`node` rather than `openssl rand -hex 32` because this is run on Windows as
often as not, and a .NET or shell builtin that exists in one PowerShell edition
and not the other is how a blank token gets set. Generate it, check it, then
write it. Supabase accepts `PURGE_TOKEN=` without complaint and stores an empty
string, and `supabase secrets list` returns a digest rather than the value, so
there is no reading it back to find out.

**Do not run `supabase secrets set --env-file supabase/functions/.env`.** That
file is local development values, and this pushes every one of them over the
linked project, including `R2_BUCKET`, which repoints the live app at the dev
bucket. It was safe when the two environments held the same values. They do not
any more. Set production secrets one at a time, by name.

That `.env` is covered by the `.env` entry in `.gitignore`, which matches at any
depth. The R2 token needs object read and write on one bucket and nothing else.
It must not be an account-level token: this key signs URLs handed to clients.

Approved photos are read back through Cloudflare Images at
`EXPO_PUBLIC_IMAGE_BASE_URL`. `lib/photos.ts` builds that URL from the same
`r2_key` the upload used, so the delivery origin has to be able to fetch the
object. Which origin that is has not been decided. See the gap list.

---

## What a maintainer still has to supply

**Half the scan exists.** Adult content goes to AWS Rekognition, wired and
verified against the real API. CSAM detection has no provider, and AWS says
outright that Rekognition "doesn't detect whether an image includes illegal
content, such as CSAM", so the two are separate jobs and only one is done.

`createModerationProvider` requires both and fails closed without either, which
is deliberate: adult-content scanning alone would let photos reach `approved`
having been checked for one thing and not the other, and "upload now, scan the
rest later" cannot be undone without a full backfill and a key rotation. So
`moderate-photo` still answers `503` and no photo is ever approved.

Whoever wires the CSAM provider settles the legal question first. A hit obliges
preserving the object and filing a report, which the REPORT Act extended from
90 days to a year, and that contradicts the `deleted_media` purge path.

The label policy in `ALLOWED_LABELS` is a product decision, not a technical one.
It is an allow list so an unrecognised label fails closed, and it currently
permits swimwear, shirtless and back shots, alcohol and rude gestures, because a
dating app that rejects every beach photo has no users.

**Known gaps, in priority order:**

- Nothing promotes an approved object out of `quarantine/`, and nothing decides
  what origin Cloudflare Images fetches from. `client-compatibility.md` asks for
  a private quarantine prefix that only approved objects leave, and that second
  half is not built. Copy-on-approval to an `approved/` prefix and rewrite
  `photos.r2_key`, or drop the prefix and say plainly that key secrecy plus the
  `photos` row is the gate. Until one of those lands, the flow is not finished.
- A presigned PUT carries no size policy, so `MAX_UPLOAD_BYTES` is checked
  after the upload and an oversized object is rejected and queued for purge.
  R2's documented S3 API lists neither POST Object nor any size condition
  (developers.cloudflare.com/r2/api/s3/api/), so there is no verified way to
  bound the size at upload time. Unresolved.
- `moderate-photo` buffers the whole object with `arrayBuffer()` before it
  checks the size, so the ceiling does not protect the function itself. A
  `Content-Length` check on the GET response would, but R2 is not obliged to
  send one.
- The declared content type is not covered by the signature, which is why
  `moderate-photo` sniffs the leading bytes rather than trusting a header.
- HEIC is not accepted. iOS clients must convert before uploading.
- `purge-deleted-media` exists but nothing calls it on a schedule yet, so keys
  accumulate until something does. It is idempotent and safe to call repeatedly.
  Every deleted photo now reaches the queue: 0011 puts that on an AFTER DELETE
  trigger, because the client, `delete_my_account()` and a profile cascade are
  three separate paths and only one of them remembered.
- A rejected photo keeps its `photos` row and therefore its `(profile_id,
  position)` slot, while its object is queued for purge. Six rejections lock a
  profile out of uploading at all. Deciding whether rejection deletes the row is
  a product call, not a cleanup.
- Nothing resizes server-side. The ~200KB target in `CLAUDE.md` is currently
  the client's responsibility alone.

---

## Commands

```bash
# serve takes no function name: it serves all of them. Checked against
# `supabase functions serve --help` on CLI 2.109.0.
supabase functions serve --env-file supabase/functions/.env

deno test supabase/functions/_shared/media.test.ts

supabase functions deploy request-photo-upload
supabase functions deploy moderate-photo
```

Both functions verify the JWT themselves, so neither depends on the gateway
setting for that. `_shared/` is not a function and is never deployed directly.

`supabase functions serve` supplies Deno in its container, so running the
functions needs Docker and the local stack but not a Deno install. The
`deno test` line above still needs one and remains unexecuted.

## What has actually been run

All three functions have been served locally, driven with a real user JWT, and
run against a real private R2 bucket (`openheart-photos-dev`, see
`infra/README.md`).

Verified end to end:

- `unauthorized`, `method_not_allowed`, `invalid_position` for both an
  out-of-range value and a non-integer, `invalid_photo_id`, `photo_not_found`
- a 201 whose presigned URL accepts a real `PUT`, and the object reads back out
  of the bucket byte-identical
- `position_taken` on a duplicate slot, `photo_limit_reached` on the seventh
- `object_not_uploaded` for a reserved slot whose object never arrived
- the format sniff, both ways: a real JPEG passes it and reaches the scanner, a
  non-image is `rejected` and its key queued in `deleted_media`
- `moderation_unavailable` with the row left pending, because no provider exists
- `purge-deleted-media` rejects a wrong token and a missing one, deletes the
  rejected object out of R2, stamps `purged_at`, leaves a legitimately pending
  object alone, and is idempotent on a second run
- the 0011 delete trigger: dropping photo rows queued their objects, including
  one whose object was never uploaded, and the purge counted that 404 as done

### Both verdicts, against the live Shield API

The line that used to sit here said no path through an actual moderation
verdict had been exercised, because no provider existed to produce one. The
credentials arrived and both halves now have.

The Canadian Centre supplied an innocuous image that returns a `csam`
classification, because their `test` classification is not in production yet.
Driven through `request-photo-upload`, a real `PUT` into the bucket, and
`moderate-photo`:

- an ordinary image classified `no-known-match` and reached **`approved`**,
  which nothing in this project had ever done before
- their fixture classified `csam`, the photo went to `rejected`, and its key was
  queued in `deleted_media` by the same call
- `purge-deleted-media` then returned `{"purged":1,"failed":0,"remaining":0}`
  and the object left the bucket

`scripts/check-shield.mjs` checks the credentials on their own, without going
near the database or the bucket, and prints the classification rather than the
credential.

### What a match does now

Running it exposed the real gap: a Shield match and a photo of a beer produced
the same outcome, so nothing downstream could tell them apart. 0020 records it.

Verified the same way, against the same fixture:

| | clean | known match |
| :--- | :--- | :--- |
| `moderation_state` | `approved` | `rejected` |
| `moderation_detail` | `clean` | `csam` |
| `csam_incidents` row | none | one, with the classification |
| account | untouched | suspended, reason `csam` |
| object | kept | queued for purge |

With `PRESERVE_CSAM_MATCHES=true` the last row becomes "held, not queued" and
the incident records `object_preserved`. **It defaults to off**, because holding
this material is only defensible once it has been reported, and reporting needs
an NCMEC registration that does not exist yet.

Two grants were missing and both failed only when run. `service_role` held
`update (moderation_state)` on `photos`, a column list, so it could not write
the new `moderation_detail`. And suspension goes through
`suspend_for_known_material()` rather than a grant, because 0017 deliberately
leaves service_role no privilege on `profiles` at all.

**Do not commit their fixture.** It is innocuous and it classifies as CSAM, so
storing it in a public repository is a problem regardless of what it depicts.

Three defects surfaced on that first run:

- **`service_role` had no table privileges at all.** It carries `rolbypassrls`,
  so 0004 recorded it as bypassing "both grants and RLS", but GRANT is checked
  before RLS and applies to every role. Both functions returned 42501 on their
  first request. Fixed in `0009_service_role_grants.sql` and guarded by
  `supabase/tests/service_role_grants.test.sql`.
- The 500 handler logged `{"message":""}` for a PostgrestError, which is what
  this file tells a maintainer to go and read. It now logs the name, code, hint
  and stack.
- An unreachable R2 threw out of `getObject` and became `internal_error` rather
  than something the client could retry.
