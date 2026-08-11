# Edge Functions

Edge Functions exist only for the things the client must not be trusted with.
Everything else is a query plus an RLS policy. These two exist because signing
an R2 upload URL needs a secret, and because `photos.moderation_state` is not
in the client's column grant in `0006_grants.sql` and never will be.

| Function | Purpose |
|---|---|
| `request-photo-upload` | Reserves a slot, issues a presigned PUT into quarantine |
| `moderate-photo` | Scans the uploaded object and writes the verdict |

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
| `R2_BUCKET` | The bucket holding `quarantine/` |
| `R2_ACCESS_KEY_ID` | R2 API token, scoped to that one bucket |
| `R2_SECRET_ACCESS_KEY` | Same token |

```bash
supabase secrets set --env-file supabase/functions/.env
supabase secrets list
```

That `.env` is covered by the `.env` entry in `.gitignore`, which matches at any
depth. The R2 token needs object read and write on one bucket and nothing else.
It must not be an account-level token: this key signs URLs handed to clients.

Approved photos are read back through Cloudflare Images at
`EXPO_PUBLIC_IMAGE_BASE_URL`. `lib/photos.ts` builds that URL from the same
`r2_key` the upload used, so the delivery origin has to be able to fetch the
object. Which origin that is has not been decided. See the gap list.

---

## What a maintainer still has to supply

**There is no moderation provider.** `_shared/moderation.ts` defines the
interface and ships an adapter that rejects every call. Nothing here calls a
real vendor API, because a signature written from memory would look correct in
review and fail in production on the single control the safety model rests on.

Until a provider is wired in, `moderate-photo` answers `503` and no photo is
ever approved. That is the correct direction to fail. The full list of what the
replacement must provide, including the CSAM requirement that generic
"unsafe image" APIs do not cover, is in the comment above the adapter.

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
- `deleted_media` is drained by a scheduled purge function that does not exist
  yet. Rejected keys accumulate until it does. Its grants are already in 0009,
  since the same missing-privilege bug would have hit it too.
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

Both functions have been served locally and driven with a real user JWT. R2
credentials in `supabase/functions/.env` were deliberately fake for this:
presigning is pure local SigV4, so everything except the transfer itself
executes.

Verified: `unauthorized`, `method_not_allowed`, `invalid_position` for both an
out-of-range value and a non-integer, a 201 carrying a correctly signed URL,
`position_taken` on a duplicate slot, `photo_limit_reached` on the seventh photo,
`invalid_photo_id`, `photo_not_found`, and `moderation_unavailable` with the row
left pending. Nothing reached `approved`, which is the point.

Not verified, and not verifiable without real credentials and a provider: the
PUT to R2, `object_not_uploaded`, the format sniff against a real object, and
every path through a moderation verdict.

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
