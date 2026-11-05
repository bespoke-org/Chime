# Deployment and environment setup

This project is a Next.js app backed by PostgreSQL and Auth.js sessions. Creators sign in with ATProto OAuth, and optionally with Google, GitHub, or any OpenID Connect provider. For a server, start at [Self-hosting with containers](#self-hosting-with-containers).

Organization-specific SSO labels and icons, access rules, mail and storage belong in deployment configuration; see [customization.md](customization.md).

## Upgrading to Chime

The Chime release changes the default names of services, containers, the database and the upload bucket. Existing resources can retain their names. Before upgrading:

1. Back up PostgreSQL and Garage, and keep the existing `.env`, `AUTH_SECRET` and storage credentials. Apply the existing migration history with `prisma migrate deploy`; no database rename or reset is required.
2. Set `POSTGRES_USER` and `POSTGRES_DB` to the role and database from the current `DATABASE_URL`. These variables also control the connection string inside `compose.prod.yaml`. The SSH deployment script derives missing values from an existing `DATABASE_URL`.
3. Keep the existing Compose project name with `COMPOSE_PROJECT_NAME`, especially if the checkout or deployment directory changes: Compose uses it to identify persistent volumes. Keep the existing `POSTGRES_CONTAINER` (for `compose.yaml`) and `GARAGE_CONTAINER` when reusing named containers. Set the same `GARAGE_CONTAINER` when running `storage:init`.
4. Retain `S3_BUCKET`, `GARAGE_KEY_NAME`, endpoints and credentials. The SSH deployment script preserves a configured bucket and key name. For `storage:init`, pass the existing bucket and container as environment variables; `GARAGE_ENV_FILE` is an output file and does not load those values for you.
5. For SSH/systemd installations, pass the existing `DEPLOY_DIR` and `SERVICE_NAME` to `bun run deploy`, so the same services are updated. Configure the OIDC provider icon with an externally hosted URL; organization emblems are no longer bundled.
6. Update webhook receivers to read `X-Chime-Event`, `X-Chime-Timestamp` and `X-Chime-Signature`; the user agent is `chime-webhook/1`. The payload and HMAC-SHA256 algorithm are unchanged. Coordinate receiver updates before switching the app.

Browser storage and the active-workspace cookie use the `chime` namespace. Previously saved respondent progress, graph positions, theme preferences and workspace selection are not restored automatically. Visitor IDs are regenerated, so returning browsers may count as new visitors. Stored forms, submitted responses and uploaded files are unaffected when the existing database and bucket are retained.

## Required environment variables

Copy `.env.example` to `.env` and provide values for:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="replace-with-a-long-random-string"
NEXTAUTH_URL="http://127.0.0.1:3000"
ATPROTO_PUBLIC_URL="http://127.0.0.1:3000"
ATPROTO_CLIENT_ID="http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fauth%2Fatproto%2Fcallback&scope=atproto%20transition%3Ageneric"
ATPROTO_REDIRECT_URI="http://127.0.0.1:3000/api/auth/atproto/callback"
ATPROTO_CLIENT_NAME="Chime"
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
# Optional allowlist of who may sign in: emails, DIDs and domains (email domain
# or ATProto handle), comma-separated. Empty keeps registration open.
# ALLOWED_SIGNIN_IDENTIFIERS="ada@example.com, example.org, did:plc:abc"
# Reverse proxies in front of the app that append to X-Forwarded-For; the
# client IP for rate limits is that many entries from the right. Default 1.
# TRUSTED_PROXY_HOPS=1
# Optional public submission limits, defaults shown
# SUBMISSION_RATE_LIMIT=5            # submissions per form per client IP per window
# SUBMISSION_GLOBAL_RATE_LIMIT=30    # submissions per client IP per window, all forms
# SUBMISSION_RATE_WINDOW_SECONDS=600
# SUBMISSION_MIN_FILL_SECONDS=3      # faster submissions are dropped as bots
# Optional zone for digest webhook schedules (IANA name), see Webhooks below
# DIGEST_TIMEZONE="UTC"
# Optional email notifications to form owners; without these the setting has no effect
# MAIL_FROM="Chime <forms@example.com>"
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
# S3_BUCKET="chime"
# S3_ACCESS_KEY_ID=""
# S3_SECRET_ACCESS_KEY=""
# UPLOAD_MAX_SIZE_MB=25                # caps the per-block limit creators may set
# UPLOAD_RATE_LIMIT=20                 # upload URL requests per client IP per window
# UPLOAD_RATE_WINDOW_SECONDS=600
# Container secrets read by compose.yaml and compose.prod.yaml, one
# `openssl rand -hex 32` each. compose.yaml has development defaults;
# compose.prod.yaml and scripts/deploy.sh require them (deploy.sh generates
# them into the server .env). Postgres applies its password only when the
# volume is created, see docs/deployment.md.
# POSTGRES_PASSWORD=""
# POSTGRES_USER="chime"
# POSTGRES_DB="chime"
# COMPOSE_PROJECT_NAME="chime"
# POSTGRES_CONTAINER="chime-postgres"
# GARAGE_CONTAINER="chime-garage"
# GARAGE_KEY_NAME="chime"
# GARAGE_RPC_SECRET=""
# GARAGE_ADMIN_TOKEN=""
```

Submission limits are counted in process memory, so they apply per app instance. The client IP is taken from `X-Forwarded-For`: each trusted reverse proxy appends the address it saw, so the client is `TRUSTED_PROXY_HOPS` entries from the right (default 1, one proxy such as Caddy or nginx in front of the app). Entries further left are sent by the client and are ignored. With `TRUSTED_PROXY_HOPS=0` the header is ignored and `X-Real-IP` is used. The proxy must set one of them or every respondent shares the same limit.

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

## Restricting who can sign in

By default anyone with an ATProto account, or an account at an enabled provider, can sign in and create forms. `ALLOWED_SIGNIN_IDENTIFIERS` limits this to a comma-separated list of emails, DIDs and domains. An email entry must match the address the provider asserts; a `did:` entry matches that ATProto DID; any other entry is a domain and matches an email at that domain or an ATProto handle equal to the domain or under it (`example.org` admits `ada.example.org`). The list is checked on every sign-in, so removing an entry also locks out existing accounts; the refused person sees "This account is not allowed to sign in here." on the sign-in page. Google and GitHub accounts have an email, so a domain entry is the usual choice for them; ATProto accounts are matched by DID or handle only.

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

## Self-hosting with containers

`compose.prod.yaml` runs the whole stack from this tree: the app image built by the `Dockerfile` (Node 22 with bun), Postgres 16, Garage and a one-shot `migrate` service that runs `prisma migrate deploy` before the app starts. The app listens on `127.0.0.1:3000` (`APP_PORT` changes the host port) and Garage's S3 API on `127.0.0.1:3900`; a reverse proxy with HTTPS in front of them is expected, Postgres is not published at all. Docker with the Compose plugin or podman-compose is needed on the host.

1. Clone the repository and copy `.env.example` to `.env`.
2. Set in `.env`: `AUTH_SECRET` (`openssl rand -base64 32`); `NEXTAUTH_URL` and `ATPROTO_PUBLIC_URL` to the public origin, for example `https://forms.example.com`; `ATPROTO_CLIENT_ID="https://forms.example.com/api/atproto/client-metadata"` and `ATPROTO_REDIRECT_URI="https://forms.example.com/api/auth/atproto/callback"`; `POSTGRES_PASSWORD`, `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN` (`openssl rand -hex 32` each). `DATABASE_URL` in `.env` is not used by this stack: compose builds it from `POSTGRES_PASSWORD` and the `postgres` service name.
3. Add the optional variables you need (sign-in providers, `ALLOWED_SIGNIN_IDENTIFIERS`, SMTP, limits) from the list above.
4. Start the stack:

   ```bash
   docker compose -f compose.prod.yaml up -d --build
   ```

   The image is built, `migrate` applies the migrations and exits, then `app` starts. `docker compose -f compose.prod.yaml logs -f app` shows the server log.

5. Point the reverse proxy at `http://127.0.0.1:3000` for the public origin, forwarding `X-Forwarded-For` (see `TRUSTED_PROXY_HOPS` above). Register the OAuth callback URLs at each provider as described in the sections above.
6. File uploads are optional. To enable them: install bun on the host and run `bun install` in the checkout, then

   ```bash
   GARAGE_ENV_FILE=.env GARAGE_KEY_NAME=chime UPLOAD_CORS_ORIGIN=https://forms.example.com bun run storage:init
   ```

   which prepares the Garage node, the `chime` bucket and a key, sets the CORS rule and writes `S3_*` into `.env`. Add `S3_PUBLIC_ENDPOINT="https://storage.example.com"` to `.env`, point that origin at `http://127.0.0.1:3900` in the proxy and run `docker compose -f compose.prod.yaml up -d app`. The `S3_ENDPOINT` written by the script is for the host; inside the stack the app uses `http://garage:3900`, set in `compose.prod.yaml`.

7. Schedule the upload cleanup from the host's cron, for example daily:

   ```cron
   0 4 * * * cd /opt/chime && docker compose -f compose.prod.yaml run --rm app bun run uploads:cleanup
   ```

   The digest webhook scheduler runs inside the app container.

To update, pull the new tree and run `docker compose -f compose.prod.yaml up -d --build` again; `migrate` runs on every start and is a no-op when nothing is pending.

### Rotating the container secrets

`GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN` are read at start: change them in `.env` and recreate the container (`docker compose -f compose.prod.yaml up -d garage`, or `podman-compose up -d` for the script setup). The S3 key pair the app uses (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) is separate and is rotated with `garage key` inside the container.

The Postgres image applies `POSTGRES_PASSWORD` only when it creates the data volume, so for a running database change the password in place and then in `.env`:

```bash
docker compose -f compose.prod.yaml exec postgres psql -U chime -d chime \
  -c "ALTER USER chime PASSWORD '<new password>'"
# script setup: podman exec chime-postgres psql -U chime -d chime -c "..."
```

Then set `POSTGRES_PASSWORD` (and, for the script setup, the password inside `DATABASE_URL`) in `.env` and restart the app.

## Deploying with scripts/deploy.sh (the author's setup)

`bun run deploy` (`scripts/deploy.sh`) ships the working tree over ssh to a host that runs the containers with podman-compose and the app with bun under systemd. It needs `DEPLOY_HOST` (ssh destination), `PUBLIC_URL` (the HTTPS origin the reverse proxy serves, forwarded to the app on `PORT`, default 8000) and, unless `ENABLE_STORAGE=0`, `STORAGE_PUBLIC_URL` (the HTTPS origin the proxy forwards to Garage on port 3900). Without them the script prints its usage and stops. `DEPLOY_DIR` defaults to `/opt/chime`.

```bash
DEPLOY_HOST=root@forms.example.com \
PUBLIC_URL=https://forms.example.com \
STORAGE_PUBLIC_URL=https://storage.example.com \
  bun run deploy
```

The script:

1. Clears the server tree except `.env`, `.next` and `node_modules`, copies the local tree without `.git`, `.env`, `.next` and `node_modules`, installs podman, podman-compose, node 22 and bun when they are missing.
2. Creates `.env` with a generated `AUTH_SECRET`, `POSTGRES_PASSWORD`, `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN` if there is none, adds the three container secrets to an older `.env` that lacks them (the running database keeps its old password until it is rotated as described above), pins `NEXTAUTH_URL` and the `ATPROTO_*` URLs to `PUBLIC_URL` and appends the optional keys as commented placeholders. Existing values are kept.
3. Starts `compose.yaml` (Postgres and Garage, ports on the loopback interface) and waits for Postgres.
4. Sets up Garage with `scripts/garage-init.sh`: layout, the configured `S3_BUCKET` and `GARAGE_KEY_NAME` (both default to `chime`), CORS rule for `PUBLIC_URL`; writes `S3_ENDPOINT=http://127.0.0.1:3900`, `S3_REGION`, `S3_BUCKET`, the key pair (only when `.env` has none) and `S3_PUBLIC_ENDPOINT=STORAGE_PUBLIC_URL`. In production `S3_PUBLIC_ENDPOINT` is required: without it the storage counts as not configured and the `FILE_UPLOAD` block answers that uploads are not available instead of handing the browser an unreachable URL.
5. Runs `bunx prisma migrate deploy` and `bun run build`.
6. Installs two systemd units: `chime-compose.service` (oneshot, `podman-compose up -d` on boot with the `.env` as `EnvironmentFile`, `down` on stop; podman does not restart containers after a reboot by itself) and `chime.service` (`bun run start` on `PORT`, `Requires=` and `After=` the compose unit). Both are enabled.
7. Schedules `bun run uploads:cleanup` daily at 04:00 through `/etc/cron.d/chime-cleanup` when `crond` is active, otherwise through `chime-cleanup.timer`.
8. Prints the state of both units and the status code of `http://127.0.0.1:<PORT>/`.

Flags, all passed as environment variables:

- `RESET_DB=1` runs `podman-compose down -v` before starting the containers: the database and the stored files are dropped and the migrations apply to an empty database. Default `0`.
- `ENABLE_STORAGE=0` skips the Garage setup. Default `1`.
- `SYNC_PROVIDER_ENV=1` copies the `OIDC_*`, `GITHUB_*` and `GOOGLE_*` lines of the local `.env` into the server `.env`, replacing the keys that exist there. Default `0`. The values travel through the ssh pipe and are not printed.
- `DEPLOY_DIR`, `PORT`, `SERVICE_NAME` override the defaults named above.

After a deployment with new providers, register the production callback URLs at each provider (`<public url>/api/auth/callback/oidc`, `/github`, `/google`), see the sections above.

Without either path, on any host: provision PostgreSQL and an S3-compatible bucket, set the variables, then `bun install`, `bunx prisma migrate deploy`, `bun run build` and `bun run start` under a process manager.

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
- `User-Agent: chime-webhook/1`
- `X-Chime-Event: response.created` or `responses.batch`
- `X-Chime-Timestamp`: Unix time in seconds when the request was signed
- `X-Chime-Signature: sha256=<hex>`, only when a secret is set

The signature is HMAC-SHA256 over `"<timestamp>.<raw body>"` with the secret as key. To verify, recompute it from the raw request body and compare with a constant-time comparison:

```
expected = hex(hmac_sha256(secret, timestamp + "." + raw_body))
ok = constant_time_equal("sha256=" + expected, signature_header)
```

Reject requests whose timestamp is far from the current time to limit replays.

Delivery waits up to 5 seconds for an answer. On a network error, a timeout, or a 5xx status the request is sent once more after 2 seconds; a 4xx status is not retried. Redirects are not followed. For `response.created` the response is stored and the respondent sees success regardless of the webhook outcome; failures are written to the server log with the form id and status.

Webhook URLs must use `http` or `https` without credentials and must not point at loopback, private, shared, link-local, multicast or unspecified addresses (`localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `224.0.0.0/4`, `0.0.0.0`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, IPv4-mapped forms of these) or at `.local` and `.internal` hostnames. The builder checks the URL as written. Before each delivery attempt the app resolves the hostname and refuses the request when any resolved address falls in those ranges, so a public-looking name that resolves into the server's network (for example `127.0.0.1.nip.io`) is not called; such a delivery is logged as `blocked_address`. The connection is still made by `fetch`, which resolves the name again, so a DNS answer that changes between the check and the connection is not caught.

### Workspace webhooks

The owner of a shared workspace can add up to ten webhooks in the workspace settings. A workspace webhook covers every form of the workspace, including forms created later, and sends the same `response.created` and `responses.batch` bodies with its own secret. Form settings show the workspace webhooks to every member as a read-only list.

When a form has its own enabled webhook with the same URL and the same mode as a workspace webhook, that form's events go only through the form webhook and its secret. URLs are compared after lowercasing the scheme and host and dropping a default port, trailing `/` and fragment; the query is kept. A form webhook and a workspace webhook in different modes both send.

A digest workspace webhook keeps one schedule and one covered period for the whole workspace. When a slot passes, it sends one `responses.batch` series per form that has responses in the period, each with `periodStart` and `periodEnd` of the webhook. When any form fails, the whole period is retried on the next run, so forms already delivered in the failed run arrive again with the same `formId`, `periodStart` and `part`; receivers should treat that triple as the key of a batch part.

### Digest schedule

A digest webhook is hourly, daily at a time of day, or weekly on a weekday at a time of day. Times are read in `DIGEST_TIMEZONE` (an IANA name, default `UTC`); the setting is app-wide and the builder shows it next to the time field. The schedule defines slots: every top of the hour, every day at the chosen time, or the chosen weekday at the chosen time. When a slot passes, the webhook receives the responses stored after the previous slot it covered (or after the webhook was created or its schedule changed) up to and including the slot. A period without responses sends nothing but still counts as covered. When the app was down over several slots, the next run sends one batch for the whole gap, not one per missed slot. A failed batch is retried on every run until it succeeds; after 24 hours of failures since the last covered slot the period is skipped and logged, so one dead endpoint cannot build an endless backlog.

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
0 4 * * * root cd /opt/chime && set -a && . ./.env && set +a && /root/.bun/bin/bun run uploads:cleanup
```

`scripts/deploy.sh` installs this line as `/etc/cron.d/chime-cleanup`; with `compose.prod.yaml` the command is `docker compose -f compose.prod.yaml run --rm app bun run uploads:cleanup`.

The script deletes pending uploads older than 24 hours in batches of 1000. Deleting a form, a file block or an organization removes the objects of its uploads from storage after the rows are gone; a failed object delete is logged and does not fail the request. Responses cannot be deleted individually, so their files stay with the form.

## Notes

- The build runs translation validation before Next.js production build.
- Response exports are generated inside the app; no separate worker is required.
- Editing a published form updates the live public form immediately.
