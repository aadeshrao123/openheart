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

## AWS, adult-content scanning

Rekognition has nothing to provision. The only resource is an identity allowed
to call one operation.

The account's own credentials are root credentials, which cannot be scoped and
cover billing and account closure. They are not used by anything here.

```bash
aws iam create-user --user-name openheart-moderation --tags Key=project,Value=openheart
aws iam put-user-policy --user-name openheart-moderation \
  --policy-name detect-moderation-labels-only \
  --policy-document file://infra/aws-moderation-policy.json
aws iam create-access-key --user-name openheart-moderation
```

The policy allows `rekognition:DetectModerationLabels` and nothing else.
Verified with the resulting key: `s3 ls`, `iam list-users` and even
`rekognition list-collections` all fail, while `detect-moderation-labels`
succeeds. `Resource` is `*` because Rekognition does not support resource-level
permissions for this action, so the action name is the whole constraint.

Region is `ap-south-1`, which is where the account was already pointed. It is an
env var, so moving it is one line, and it is worth revisiting when the launch
city is known: the images sent for scanning are photographs of users, and which
country processes them is a data protection question rather than a latency one.

AWS states plainly that these APIs "don't detect whether an image includes
illegal content, such as CSAM". That is why `createModerationProvider` requires
a second provider and fails closed without it.

## API tokens

Wrangler cannot create the S3-compatible Access Key ID and Secret Access Key
that `_shared/r2.ts` signs with. `wrangler r2 bucket` manages buckets only, so
the token is made by hand in the dashboard, scoped to one bucket, and pasted
straight into `supabase/functions/.env`, which is gitignored.
