# Cloudflare configuration

The same rule as `supabase/migrations/`: nothing here is configured by clicking
in a dashboard, because a dashboard change is absent from git, absent from every
other contributor's machine, and absent from production until someone remembers
it.

Set `CLOUDFLARE_ACCOUNT_ID` before running anything. The Wrangler login may see
more than one account, and it will not guess.

## Buckets

| Bucket | Purpose |
|---|---|
| `openheart-photos-dev` | Local development. Never holds a real person's photo. |

Production gets its own bucket, created when the launch city is known: the
location hint is fixed at creation and cannot be changed afterwards.

```bash
wrangler r2 bucket create openheart-photos-dev --location weur
```

Public access stays off. It is off by default, and the moderation design depends
on it: the only route to a visible photo is a scan followed by an `approved`
row, and a public bucket bypasses all of it. Verify with:

```bash
wrangler r2 bucket dev-url get openheart-photos-dev
```

## CORS

Only the web build needs this. Native apps do not perform preflight requests,
but a browser PUT that carries a `Content-Type` header does, and R2 rejects it
without a matching rule.

`PUT` only. Clients never read from R2 directly: approved objects are served
through the delivery origin in `EXPO_PUBLIC_IMAGE_BASE_URL`.

Origins must match exactly, wildcards included, so every dev port and the
production domain has to be listed.

```bash
wrangler r2 bucket cors set openheart-photos-dev --file infra/r2-cors.json
wrangler r2 bucket cors list openheart-photos-dev
```

Note the schema here is Wrangler's (`rules[].allowed.origins`), which is not the
same shape the dashboard shows for the same policy.

## API tokens

Wrangler cannot create the S3-compatible Access Key ID and Secret Access Key
that `_shared/r2.ts` signs with. `wrangler r2 bucket` manages buckets only, so
the token is made by hand in the dashboard, scoped to one bucket, and pasted
straight into `supabase/functions/.env`, which is gitignored.
