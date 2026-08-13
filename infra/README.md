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
| `openheart-photos` | Production. `WEUR`, to sit near the Frankfurt database. |

The location hint is fixed at creation and cannot be changed afterwards, which
is why production waited for the database region to be decided.

```bash
wrangler r2 bucket create openheart-photos-dev --location weur
wrangler r2 bucket create openheart-photos --location weur
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

wrangler r2 bucket cors set openheart-photos --file infra/r2-cors-prod.json
wrangler r2 bucket cors list openheart-photos
```

The two files differ deliberately: dev allows the localhost ports, production
allows only `https://openheartapp.org`. Neither lists the other's origins.

The production S3 token is the one thing here made in the dashboard, because
Wrangler has no command to mint one. R2 -> API -> Manage API Tokens, **Object
Read & Write**, scoped to `openheart-photos` alone, TTL forever. Object scoped
rather than admin, so it cannot create, delete or reconfigure a bucket.

Verified against the real bucket rather than read off the policy: PUT returned
200, GET came back byte-identical, and `purge-deleted-media` reported
`{"purged":1,"failed":0,"remaining":0}`. That last one is the reason to check.
"Object Read & Write" reads like it might not include DELETE, and the purge is
useless without it.

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
  --policy-name openheart-rekognition \
  --policy-document file://infra/aws-moderation-policy.json
aws iam create-access-key --user-name openheart-moderation
```

Production has its own identity, same policy, so a leaked development key
cannot be used against production and either can be revoked alone:

```bash
aws iam create-user --user-name openheart-moderation-prod \
  --tags Key=project,Value=openheart Key=env,Value=production
aws iam put-user-policy --user-name openheart-moderation-prod \
  --policy-name openheart-rekognition \
  --policy-document file://infra/aws-moderation-policy.json
aws iam create-access-key --user-name openheart-moderation-prod
```

The policy allows three actions and nothing else. `DetectModerationLabels`
scans every uploaded photo; `DetectFaces` and `CompareFaces` are the two halves
of photo verification. `Resource` is `*` because Rekognition supports no
resource-level permission for any of them, so the action names are the whole
constraint.

Verified with each key rather than by reading the policy back.

Development:

```
detect-faces      -> []                          authorized, no face in frame
compare-faces     -> InvalidParameterException    authorized, no face to compare
list-collections  -> AccessDeniedException        still denied
```

Production, checked the same way and denied all three:

```
list-collections  -> AccessDeniedException
s3 ls             -> AccessDenied
iam list-users    -> AccessDenied
```

An InvalidParameterException is the useful answer there. It means the call was
allowed and the image simply had no face in it, where a missing permission
fails with AccessDeniedException instead. `s3 ls` and `iam list-users` fail the
same way.

It was first created as `detect-moderation-labels-only`, which stopped being
true when verification was added. An inline policy is renamed by writing the
new name and deleting the old one, so an account set up before that needs:

```bash
aws iam delete-user-policy --user-name openheart-moderation \
  --policy-name detect-moderation-labels-only
```

Read the account rather than this file when you want to know what is allowed:

```bash
aws iam list-user-policies --user-name openheart-moderation
aws iam get-user-policy --user-name openheart-moderation \
  --policy-name openheart-rekognition
```

Region is `ap-south-1`, which is where the account was already pointed. It is an
env var, so moving it is one line, and it is worth revisiting when the launch
city is known: the images sent for scanning are photographs of users, and which
country processes them is a data protection question rather than a latency one.

AWS states plainly that these APIs "don't detect whether an image includes
illegal content, such as CSAM". That is why `createModerationProvider` requires
a second provider and fails closed without it.

## Pages

The web build. `openheart`, production branch `main`, reachable at
`openheart-5jx.pages.dev` before the custom domain is attached.

```bash
wrangler pages project create openheart --production-branch main
node scripts/build-web.mjs
wrangler pages deploy dist --project-name openheart --branch main
```

Deploys run from CI rather than a laptop, and only when somebody asks:
Actions -> CI -> Run workflow, on `main`. The `deploy` job in
`.github/workflows/ci.yml` is `workflow_dispatch` only.

Not on push, deliberately. Merging and publishing are different decisions, and
a green suite is not the same claim as "safe for the people using it". It still
needs all four other jobs, so pressing the button on a broken commit deploys
nothing, and a pull request from a fork can never reach the domain.

It needs five GitHub secrets:

| Secret | What |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages: Edit, scoped to this account |
| `CLOUDFLARE_ACCOUNT_ID` | the account the bucket and Pages project live in |
| `EXPO_PUBLIC_SUPABASE_URL` | the production project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | public by design, still not committed |
| `EXPO_PUBLIC_IMAGE_BASE_URL` | the image Worker origin |

**Never build with `expo export` directly.** `scripts/build-web.mjs` exists
because that command read `.env` and baked `127.0.0.1:54321` into a bundle that
was one command away from being deployed. It built, every route was the right
size, and every request it made would have gone nowhere. The script reads
`.env.production` when present and the ambient environment otherwise, then
greps the emitted bundle and refuses to hand over one carrying a local address.

The custom domain is attached in the dashboard, because Wrangler has no Pages
domain command. Workers and Pages -> openheart -> Custom domains ->
`openheartapp.org`. The DNS record is created automatically while the zone is
on the same account.

## Image Worker

Serves photos from the private bucket, resized. `infra/image-worker`, on
`images.openheartapp.org`, which `custom_domain = true` created along with the
DNS record.

```bash
cd infra/image-worker && wrangler deploy
```

The R2 binding is the credential, so there is no key in the Worker and the
bucket keeps no public URL. URLs are `/<variant>/<key>` and the Worker owns the
sizes: a client that could name its own width could ask for a 10000px transform
of every object in the bucket.

Only keys under `quarantine/` are served. `verification/` holds selfies, which
are moderator-only through a short lived signed URL, and serving any key would
hand somebody's face to anyone who learned one. Checked against the real bucket
with a selfie actually in it:

```
thumb of a profile photo       200  image/webp  1008B   from 11674B
medium of the same             200  image/webp  3636B
a verification selfie          404
an invented variant            404
an object that does not exist  404
```

Every response carries `X-Robots-Tag: noindex, noimageindex`.

Deploying from CI needs **Workers Scripts: Edit** on the API token, which
Pages: Edit does not cover.

## API tokens

Wrangler cannot create the S3-compatible Access Key ID and Secret Access Key
that `_shared/r2.ts` signs with. `wrangler r2 bucket` manages buckets only, so
the token is made by hand in the dashboard, scoped to one bucket, and pasted
straight into `supabase/functions/.env`, which is gitignored.
