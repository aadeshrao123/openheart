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

## Email, Amazon SES

Sign-in is an emailed six digit code, so email is the entire front door.
Supabase's built-in sender is rate limited to a handful an hour and is not for
production.

`eu-central-1`, not `ap-south-1` where Rekognition runs. The messages carry a
user's email address, and the database that already holds it is in Frankfurt.

**Sending is from `send.openheartapp.org`, never the root.** A domain may
publish exactly one SPF record. The root belongs to Google Workspace, and a
second SPF for SES would not merge with a Workspace one, it would make SPF fail
with a permanent error and take human mail down with it. A subdomain also keeps
reputation separate, which matters when the mail goes to people who have not
opted in to anything yet.

```bash
aws sesv2 create-email-identity --region eu-central-1 \
  --email-identity send.openheartapp.org \
  --dkim-signing-attributes NextSigningKeyLength=RSA_2048_BIT

aws sesv2 put-email-identity-mail-from-attributes --region eu-central-1 \
  --email-identity send.openheartapp.org \
  --mail-from-domain bounce.send.openheartapp.org \
  --behavior-on-mx-failure USE_DEFAULT_VALUE
```

The MAIL FROM subdomain exists for SPF alignment: without it the envelope
sender is an amazonses.com address and the domain in the From header is not the
domain SPF was checked against.

`ses-dns.zone` is generated from the identity and imported into Cloudflare
whole. Regenerate it rather than editing it, and note that DKIM tokens change
if the identity is ever recreated.

The sender is a scoped IAM user, same pattern as the moderation ones:

```bash
aws iam create-user --user-name openheart-mailer \
  --tags Key=project,Value=openheart Key=env,Value=production
aws iam put-user-policy --user-name openheart-mailer \
  --policy-name openheart-ses-send \
  --policy-document file://infra/aws-mailer-policy.json
aws iam create-access-key --user-name openheart-mailer
```

The policy allows one action on one identity from one address, so a leaked key
cannot send as anything else.

**An SMTP password is not the secret access key.** It is derived from it with
five chained HMACs, documented under SES SMTP credentials, and there is no API
that returns one. `scripts/ses-smtp-password.mjs` does the derivation and writes
to a gitignored file so the value never reaches a terminal.

Production access granted: 50,000 a day, 14 a second, against the 200 a day the
launch needs. Account-level suppression is on for BOUNCE and COMPLAINT, so an
address that hard bounces is not retried and cannot keep damaging the rate.

```bash
aws sesv2 create-configuration-set --region eu-central-1 \
  --configuration-set-name openheart-transactional \
  --reputation-options ReputationMetricsEnabled=true \
  --suppression-options SuppressedReasons=BOUNCE,COMPLAINT \
  --delivery-options TlsPolicy=REQUIRE

aws sesv2 put-email-identity-configuration-set-attributes --region eu-central-1 \
  --email-identity send.openheartapp.org \
  --configuration-set-name openheart-transactional
```

Not bought, and not by accident: Virtual Deliverability Manager charges per
message, and a dedicated IP is about 25 dollars a month and is worse than a
shared one below roughly 100k sends a month, because there is no volume to build
a reputation with.

Verified by sending rather than by reading the console. SMTP auth returned 235,
the message was accepted, and CloudWatch recorded Send 1, Delivery 1, Bounce 0,
Complaint 0, Reject 0.

The two numbers that matter afterwards are on SES, Reputation metrics: bounce
under 5 percent and complaint under 0.1 percent. Complaint is the one that
suspends an account.

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

It needs six GitHub secrets:

| Secret | What |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages: Edit, scoped to this account |
| `CLOUDFLARE_WORKER_API_TOKEN` | Workers Scripts: Edit, for the image Worker |
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

Deploying from CI uses its own token, CLOUDFLARE_WORKER_API_TOKEN, carrying
Workers Scripts: Edit. The Pages token does not cover it.

## API tokens

Wrangler cannot create the S3-compatible Access Key ID and Secret Access Key
that `_shared/r2.ts` signs with. `wrangler r2 bucket` manages buckets only, so
the token is made by hand in the dashboard, scoped to one bucket, and pasted
straight into `supabase/functions/.env`, which is gitignored.
