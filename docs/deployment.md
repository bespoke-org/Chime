# Deployment and environment setup

This project is a Next.js app backed by PostgreSQL and Auth.js sessions. Creators sign in with ATProto OAuth, and optionally with Google, GitHub, or any OpenID Connect provider.

## Required environment variables

Copy `.env.example` to `.env` and provide values for:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="replace-with-a-long-random-string"
NEXTAUTH_URL="http://127.0.0.1:3000"
ATPROTO_PUBLIC_URL="http://127.0.0.1:3000"
ATPROTO_CLIENT_ID="http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fauth%2Fatproto%2Fcallback&scope=atproto%20transition%3Ageneric"
ATPROTO_REDIRECT_URI="http://127.0.0.1:3000/api/auth/atproto/callback"
ATPROTO_CLIENT_NAME="Lively Forms"
# Optional, defaults to "atproto transition:generic"
# ATPROTO_SCOPE="atproto transition:generic"
# Optional OAuth sign-in providers; each is shown only when its variables are set
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_CLIENT_ID=""
# GITHUB_CLIENT_SECRET=""
# OIDC_ISSUER="https://auth.example.com/realms/master"
# OIDC_CLIENT_ID=""
# OIDC_CLIENT_SECRET=""
# OIDC_PROVIDER_NAME="SSO"               # sign-in button label
# OIDC_PROVIDER_ICON_URL=""              # optional monochrome SVG shown on the button
# OIDC_SCOPE="openid profile email"
# Optional public submission limits, defaults shown
# SUBMISSION_RATE_LIMIT=5            # submissions per form per client IP per window
# SUBMISSION_GLOBAL_RATE_LIMIT=30    # submissions per client IP per window, all forms
# SUBMISSION_RATE_WINDOW_SECONDS=600
# SUBMISSION_MIN_FILL_SECONDS=3      # faster submissions are dropped as bots
# Optional zone for digest webhook schedules (IANA name), see Webhooks below
# DIGEST_TIMEZONE="Europe/Saratov"
# Optional email notifications to form owners; without these the setting has no effect
# MAIL_FROM="Lively Forms <forms@example.com>"
# SMTP_URL="smtp://user:password@smtp.example.com:587"
# Or the split form instead of SMTP_URL
# SMTP_HOST="smtp.example.com"
# SMTP_PORT=587                      # defaults to 465 when SMTP_SECURE is set, 587 otherwise
# SMTP_USER="user"
# SMTP_PASSWORD="password"
# SMTP_SECURE=false                  # true or 1 for implicit TLS
# Optional file uploads; without these the FILE_UPLOAD block answers 503
# S3_ENDPOINT="http://127.0.0.1:3900"          # reached by the server
# S3_PUBLIC_ENDPOINT="http://127.0.0.1:3900"   # reached by the browser, defaults to S3_ENDPOINT
# S3_REGION="garage"
# S3_BUCKET="lively-forms"
# S3_ACCESS_KEY_ID=""
# S3_SECRET_ACCESS_KEY=""
# UPLOAD_MAX_SIZE_MB=25                # caps the per-block limit creators may set
# UPLOAD_RATE_LIMIT=20                 # upload URL requests per client IP per window
# UPLOAD_RATE_WINDOW_SECONDS=600
```

Submission limits are counted in process memory, so they apply per app instance. The client IP is read from the first `X-Forwarded-For` entry, then `X-Real-IP`; the reverse proxy must set one of them or every respondent shares the same limit.

Generate a strong auth secret, for example:

```bash
openssl rand -base64 32
```

For local loopback development, ATProto uses a special `http://localhost?...` client ID that declares the loopback redirect URI and scope in the query string. In production, `ATPROTO_CLIENT_ID` must be an HTTPS URL where the app serves public OAuth client metadata.

## Local development setup

### 1. Install dependencies

```bash
bun install
```

### 2. Start PostgreSQL

```bash
bun run db:up
```

This uses `compose.yaml` and starts Postgres on `127.0.0.1:5432`.

### 3. Run Prisma migrations

```bash
bun run prisma:migrate
```

### 4. Start the app

```bash
bun run dev
```

## OAuth and OpenID Connect sign-in

Google, GitHub, and a generic OpenID Connect provider are registered in Auth.js only when their variables are set, so a deployment can run with ATProto alone. Each enabled provider adds a button above the ATProto form on the sign-in page. Accounts are linked by provider and provider account id, not by email: a person who signed in with Google and later tries GitHub with the same email gets "This email is already used by another sign-in method" instead of a merged account. On the first sign-in the app fills the empty profile fields (name parts, avatar, notification email) from the provider profile and never overwrites values the creator has edited.

### Google

Create an OAuth client in Google Cloud Console (APIs & Services > Credentials > OAuth client ID, type Web application) and set:

- Authorized redirect URI: `<public url>/api/auth/callback/google`

Put the client id and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### GitHub

Create an OAuth App in GitHub (Settings > Developer settings > OAuth Apps) and set:

- Authorization callback URL: `<public url>/api/auth/callback/github`

Put the client id and secret into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. When the user hides their email on GitHub the app requests the primary address through the GitHub API; if none is returned the notification email stays empty.

### OpenID Connect (Keycloak)

`OIDC_ISSUER` is the issuer URL, for example `https://auth.example.com/realms/master`; the app reads `<issuer>/.well-known/openid-configuration` at the first sign-in, so the issuer must be reachable from the server. The provider must support the authorization code flow with PKCE (S256) and the scopes in `OIDC_SCOPE` (default `openid profile email`). `OIDC_PROVIDER_NAME` is the label on the sign-in button ("Continue with SSO" by default) and `OIDC_PROVIDER_ICON_URL` an optional URL of a monochrome SVG rendered next to it in the text color. The callback path is `/api/auth/callback/oidc`.

In Keycloak create a client in the realm:

- Client type: OpenID Connect
- Client authentication: on
- Authentication flow: Standard flow
- Valid redirect URIs: `<public url>/api/auth/callback/oidc`
- Web origins: `<public url>`

Copy the client id and the secret from the Credentials tab into `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`.

## ATProto OAuth setup

ATProto OAuth discovers the user's PDS from the handle or DID submitted on the sign-in form. The app also exposes public OAuth client metadata for HTTPS deployments where PDS authorization servers must fetch client metadata by URL.

### Local OAuth settings

Use these values during local development:

**Client ID**

- `http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fauth%2Fatproto%2Fcallback&scope=atproto%20transition%3Ageneric`

**Redirect URI**

- `http://127.0.0.1:3000/api/auth/atproto/callback`

Open the app at `http://127.0.0.1:3000` so the callback host matches the configured loopback redirect URI.

### Production OAuth settings

For a deployed environment, replace the loopback values with your real HTTPS domain.

Example:

**Client metadata URL / client ID**

- `https://your-domain.example/api/atproto/client-metadata`

**Redirect URI**

- `https://your-domain.example/api/auth/atproto/callback`

Set `NEXTAUTH_URL` and `ATPROTO_PUBLIC_URL` to the same public base URL. If the client metadata URL or redirect URI are missing or incorrect, ATProto sign-in will fail before an app session is created.

## Production deployment checklist

The stage server runs the containers with podman and podman-compose; docker is not installed there and must not be. `bun run deploy` (`scripts/deploy.sh`) does the steps below over ssh for `DEPLOY_HOST` (default `root@10.72.30.114`, directory `/opt/lively-forms`):

1. Clears the server tree except `.env`, `.next` and `node_modules`, copies the local tree without `.git`, `.env`, `.next` and `node_modules`, installs podman, podman-compose, node 22 and bun when they are missing.
2. Creates `.env` with a generated `AUTH_SECRET` if there is none, pins `NEXTAUTH_URL` and the `ATPROTO_*` URLs to `PUBLIC_URL` (default `https://forms.alivetech.org`) and appends the optional keys as commented placeholders. Existing values are kept.
3. Removes the stale `the-forms-postgres` container, starts `compose.yaml` (Postgres and Garage) and waits for Postgres.
4. Sets up Garage with `scripts/garage-init.sh`: layout, bucket `lively-forms`, key `lively-forms`, CORS rule for `PUBLIC_URL`; writes `S3_ENDPOINT=http://127.0.0.1:3900`, `S3_REGION`, `S3_BUCKET`, the key pair (only when `.env` has none) and `S3_PUBLIC_ENDPOINT=STORAGE_PUBLIC_URL` (default `https://storage.forms.alivetech.org`, proxied by the gate to port 3900 on the server). In production `S3_PUBLIC_ENDPOINT` is required: without it the storage counts as not configured and the `FILE_UPLOAD` block answers that uploads are not available instead of handing the browser an unreachable URL.
5. Runs `bunx prisma migrate deploy` and `bun run build`.
6. Installs two systemd units: `lively-forms-compose.service` (oneshot, `podman-compose up -d` on boot, `down` on stop; podman does not restart containers after a reboot by itself) and `lively-forms.service` (`bun run start` on port 8000, `Requires=` and `After=` the compose unit). Both are enabled.
7. Schedules `bun run uploads:cleanup` daily at 04:00 through `/etc/cron.d/lively-forms-cleanup` when `crond` is active, otherwise through `lively-forms-cleanup.timer`.
8. Prints the state of both units and the status code of `http://127.0.0.1:8000/`.

Flags, all passed as environment variables:

- `RESET_DB=1` runs `podman-compose down -v` before starting the containers: the database and the stored files are dropped and the migrations apply to an empty database. Default `0`.
- `ENABLE_STORAGE=0` skips the Garage setup. Default `1`.
- `SYNC_PROVIDER_ENV=1` copies the `OIDC_*`, `GITHUB_*` and `GOOGLE_*` lines of the local `.env` into the server `.env`, replacing the keys that exist there. Default `0`. The values travel through the ssh pipe and are not printed.
- `STORAGE_PUBLIC_URL`, `PUBLIC_URL`, `DEPLOY_HOST`, `DEPLOY_DIR`, `PORT` override the defaults named above.

Example:

```bash
RESET_DB=1 SYNC_PROVIDER_ENV=1 bun run deploy
```

After a deployment with new providers, register the production callback URLs at each provider (`<public url>/api/auth/callback/oidc`, `/github`, `/google`), see the sections above.

Without the script, on any host: provision PostgreSQL and an S3-compatible bucket, set the variables, then `bun install`, `bunx prisma migrate deploy`, `bun run build` and `bun run start` under a process manager.

## Webhooks

A form can have up to ten webhooks, managed in its settings. Each has a URL, an optional signing secret, an on/off switch and a delivery mode: `response.created` sends one request per response right after it is stored; `responses.batch` sends one request per period with every response stored in that period. Both are JSON `POST` bodies, and a batch item carries exactly the `responseId`, `submittedAt`, `identity` and `answers` fields of a single `response.created` body.

A `response.created` body:

```json
{
  "event": "response.created",
  "formId": "cmf...",
  "formSlug": "customer-survey",
  "formTitle": "Customer survey",
  "formUrl": "https://forms.example.com/f/customer-survey",
  "responseId": "cmr...",
  "responseUrl": "https://forms.example.com/forms/cmf.../responses/cmr...",
  "submittedAt": "2026-10-18T10:00:00.000Z",
  "identity": [
    { "key": "name", "blockId": "cmb...", "title": "Name", "value": "Ada" }
  ],
  "answers": [
    {
      "blockId": "cmb...",
      "type": "SHORT_TEXT",
      "title": "Name",
      "value": "Ada"
    },
    {
      "blockId": "cmb...",
      "type": "MULTIPLE_CHOICE",
      "title": "Topics",
      "value": ["a", "b"]
    }
  ]
}
```

A `responses.batch` body with two responses:

```json
{
  "event": "responses.batch",
  "formId": "cmf...",
  "formSlug": "customer-survey",
  "formTitle": "Customer survey",
  "periodStart": "2026-10-18T05:00:00.000Z",
  "periodEnd": "2026-10-19T05:00:00.000Z",
  "part": 1,
  "parts": 1,
  "responses": [
    {
      "responseId": "cmr...",
      "submittedAt": "2026-10-18T10:00:00.000Z",
      "identity": [],
      "answers": [
        {
          "blockId": "cmb...",
          "type": "SHORT_TEXT",
          "title": "Name",
          "value": "Ada"
        }
      ]
    },
    {
      "responseId": "cmr...",
      "submittedAt": "2026-10-19T01:30:00.000Z",
      "identity": [],
      "answers": [
        {
          "blockId": "cmb...",
          "type": "SHORT_TEXT",
          "title": "Name",
          "value": "Bob"
        }
      ]
    }
  ]
}
```

`answers` lists the question blocks the respondent reached, in form order; skipped branches and text blocks are left out. `value` is a string, or an array of strings for multiple choice; a file answer is the authenticated download URL. `responses` are ordered by `submittedAt` and the period is `(periodStart, periodEnd]`. A batch holds at most 200 responses; a longer period is sent as several requests in the same run with `part` counting up to `parts` and the same period bounds.

Request headers:

- `Content-Type: application/json`
- `User-Agent: lively-forms-webhook/1`
- `X-Lively-Forms-Event: response.created` or `responses.batch`
- `X-Lively-Forms-Timestamp`: Unix time in seconds when the request was signed
- `X-Lively-Forms-Signature: sha256=<hex>`, only when a secret is set

The signature is HMAC-SHA256 over `"<timestamp>.<raw body>"` with the secret as key. To verify, recompute it from the raw request body and compare with a constant-time comparison:

```
expected = hex(hmac_sha256(secret, timestamp + "." + raw_body))
ok = constant_time_equal("sha256=" + expected, signature_header)
```

Reject requests whose timestamp is far from the current time to limit replays.

Delivery waits up to 5 seconds for an answer. On a network error, a timeout, or a 5xx status the request is sent once more after 2 seconds; a 4xx status is not retried. Redirects are not followed. For `response.created` the response is stored and the respondent sees success regardless of the webhook outcome; failures are written to the server log with the form id and status.

Webhook URLs must use `http` or `https` without credentials and must not point at loopback, private, link-local, or unspecified addresses (`localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0`, `::1`, IPv4-mapped forms of these) or at `.local` and `.internal` hostnames. The check is made on the URL as written; it does not resolve DNS.

### Workspace webhooks

The owner of a shared workspace can add up to ten webhooks in the workspace settings. A workspace webhook covers every form of the workspace, including forms created later, and sends the same `response.created` and `responses.batch` bodies with its own secret. Form settings show the workspace webhooks to every member as a read-only list.

When a form has its own enabled webhook with the same URL and the same mode as a workspace webhook, that form's events go only through the form webhook and its secret. URLs are compared after lowercasing the scheme and host and dropping a default port, trailing `/` and fragment; the query is kept. A form webhook and a workspace webhook in different modes both send.

A digest workspace webhook keeps one schedule and one covered period for the whole workspace. When a slot passes, it sends one `responses.batch` series per form that has responses in the period, each with `periodStart` and `periodEnd` of the webhook. When any form fails, the whole period is retried on the next run, so forms already delivered in the failed run arrive again with the same `formId`, `periodStart` and `part`; receivers should treat that triple as the key of a batch part.

### Digest schedule

A digest webhook is hourly, daily at a time of day, or weekly on a weekday at a time of day. Times are read in `DIGEST_TIMEZONE` (an IANA name, default `Europe/Saratov`); the setting is app-wide and the builder shows it next to the time field. The schedule defines slots: every top of the hour, every day at the chosen time, or the chosen weekday at the chosen time. When a slot passes, the webhook receives the responses stored after the previous slot it covered (or after the webhook was created or its schedule changed) up to and including the slot. A period without responses sends nothing but still counts as covered. When the app was down over several slots, the next run sends one batch for the whole gap, not one per missed slot. A failed batch is retried on every run until it succeeds; after 24 hours of failures since the last covered slot the period is skipped and logged, so one dead endpoint cannot build an endless backlog.

The scheduler runs inside the Next.js server process (`instrumentation.ts`) once a minute and assumes a single app instance; with several instances each would send its own batch. When the app is not kept running as a single long-lived process, do not rely on the built-in timer and run `bun run webhooks:digest` from cron instead, for example every minute; it sends everything that is due and exits.

## Email notifications

A creator can enter a notification email in profile settings and turn on "Email me about new responses" in a form's settings. The switch is a personal subscription: each member of a workspace sets it for themselves on each form, and it is saved at once, independently of the other form settings. After a response is stored, the app sends one email to every subscribed member who has a notification email, with the form title, the answers the respondent gave in form order, and a link to the response page. The subject and labels follow each recipient's language setting; the link is built from `NEXTAUTH_URL`. Removing a member from an organization drops their subscriptions on its forms.

Sending uses SMTP through nodemailer. `MAIL_FROM` is required, plus either `SMTP_URL` (for example `smtp://user:password@host:587` or `smtps://user:password@host:465`) or the split variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_SECURE`. Without `MAIL_FROM` and a host the mailer is not configured: the checkbox can still be saved but no email is sent, and the server log carries one warning the first time a send is attempted.

The response is stored and the respondent sees success regardless of the email outcome. A failed send is logged with the form id and the recipient's domain, one line per recipient; addresses and message content are not written to the log.

## Form closing

A published form can stop accepting responses by a closing time, a response limit, or a manual switch in its settings. Respondents who open a closed form see its title and the closed message instead of the questions, and a submission to a closed form is answered with `410` and `{ "error": "This form is no longer accepting responses." }`. Unpublished forms keep answering `404`.

The closing time is stored in UTC and compared against the server clock, so the server's time must be correct. The response limit is checked by counting stored responses right before the insert without a lock; two submissions arriving at the same moment can exceed the limit by one.

## File uploads

A `FILE_UPLOAD` block lets a respondent attach one file. The browser asks the app for a presigned `PUT` URL (`POST /api/public/forms/<slug>/uploads`), sends the bytes straight to object storage, and submits the returned upload id as the answer. On submission the app checks that the id names a pending upload of that form and block, that the object exists and that its size is within the block's limit; otherwise the submission is rejected with `422`. Creators download files through `GET /api/forms/<formId>/uploads/<uploadId>`, which requires access to the form and redirects to a presigned URL valid for 5 minutes. Exports, webhooks and notification emails carry that URL in place of the answer.

Storage is any S3-compatible service reached with path-style addressing. The reference setup is [Garage](https://garagehq.deuxfleurs.fr), a single binary under the AGPL; AWS S3, Ceph RGW or similar work with the same variables:

- `S3_ENDPOINT` is the URL the app server uses. `S3_PUBLIC_ENDPOINT` is the URL the respondent's browser can reach and defaults to `S3_ENDPOINT`; presigned URLs are generated for it. Set both when storage is on a private network behind a reverse proxy.
- `S3_REGION` is whatever the service expects (`garage` for Garage, `us-east-1` for AWS).
- The key needs read and write on `S3_BUCKET`. Owner permission is only needed to set the CORS rule.
- The bucket must have a CORS rule allowing `PUT` and `GET` from the app's origin with any request header, otherwise browsers refuse the upload. `UPLOAD_CORS_ORIGIN=https://your-domain.example bun run scripts/garage-cors.ts` sets it through the S3 API on any service.
- `UPLOAD_MAX_SIZE_MB` (default 25) caps the per-block limit creators can choose. `UPLOAD_RATE_LIMIT` upload URL requests per client IP and `UPLOAD_RATE_WINDOW_SECONDS` work like the submission limits.

Executable and HTML types (`application/x-msdownload`, `application/x-sh`, `application/x-executable`, `application/java-archive`, `application/x-msi`, `text/html`, `application/xhtml+xml`, `image/svg+xml`) are never accepted. Downloads always carry `Content-Disposition: attachment`.

Uploads that were requested but never attached to a response stay `PENDING`. Remove them, with their objects, from cron:

```cron
0 4 * * * root cd /opt/lively-forms && set -a && . ./.env && set +a && /root/.bun/bin/bun run uploads:cleanup
```

`scripts/deploy.sh` installs this line as `/etc/cron.d/lively-forms-cleanup`.

The script deletes pending uploads older than 24 hours in batches of 1000. Deleting a form, a file block or an organization removes the objects of its uploads from storage after the rows are gone; a failed object delete is logged and does not fail the request. Responses cannot be deleted individually, so their files stay with the form.

## Notes

- The build runs translation validation before Next.js production build.
- Response exports are generated inside the app; no separate worker is required.
- Editing a published form updates the live public form immediately.
