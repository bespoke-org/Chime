# Deployment and environment setup

This project is a Next.js app backed by PostgreSQL and Auth.js sessions with ATProto OAuth for creator sign-in.

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
# Optional public submission limits, defaults shown
# SUBMISSION_RATE_LIMIT=5            # submissions per form per client IP per window
# SUBMISSION_GLOBAL_RATE_LIMIT=30    # submissions per client IP per window, all forms
# SUBMISSION_RATE_WINDOW_SECONDS=600
# SUBMISSION_MIN_FILL_SECONDS=3      # faster submissions are dropped as bots
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

1. Provision a PostgreSQL database.
2. Set the required environment variables.
3. Configure the public ATProto client metadata and callback URLs for the production domain.
4. Install dependencies:

   ```bash
   bun install
   ```

5. Run production database migrations:

   ```bash
   bunx prisma migrate deploy
   ```

6. Build the app:

   ```bash
   bun run build
   ```

7. Start the server with your process manager of choice:

   ```bash
   bun run start
   ```

## Webhooks

A form can name a webhook URL and an optional signing secret in its settings. After a response is stored, the app sends one `POST` with a JSON body to that URL:

```json
{
  "event": "response.created",
  "formId": "cmf...",
  "formSlug": "customer-survey",
  "formTitle": "Customer survey",
  "responseId": "cmr...",
  "submittedAt": "2026-10-18T10:00:00.000Z",
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

`answers` lists the question blocks the respondent reached, in form order; skipped branches and text blocks are left out. `value` is a string, or an array of strings for multiple choice.

Request headers:

- `Content-Type: application/json`
- `User-Agent: lively-forms-webhook/1`
- `X-Lively-Forms-Event: response.created`
- `X-Lively-Forms-Timestamp`: Unix time in seconds when the request was signed
- `X-Lively-Forms-Signature: sha256=<hex>`, only when a secret is set

The signature is HMAC-SHA256 over `"<timestamp>.<raw body>"` with the secret as key. To verify, recompute it from the raw request body and compare with a constant-time comparison:

```
expected = hex(hmac_sha256(secret, timestamp + "." + raw_body))
ok = constant_time_equal("sha256=" + expected, signature_header)
```

Reject requests whose timestamp is far from the current time to limit replays.

Delivery waits up to 5 seconds for an answer. On a network error, a timeout, or a 5xx status the request is sent once more after 2 seconds; a 4xx status is not retried. Redirects are not followed. The response is stored and the respondent sees success regardless of the webhook outcome; failures are written to the server log with the form id and status.

Webhook URLs must use `http` or `https` without credentials and must not point at loopback, private, link-local, or unspecified addresses (`localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0`, `::1`, IPv4-mapped forms of these) or at `.local` and `.internal` hostnames. The check is made on the URL as written; it does not resolve DNS.

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
0 * * * * cd /opt/lively-forms && set -a && . ./.env && set +a && bun run uploads:cleanup
```

The script deletes pending uploads older than 24 hours in batches of 1000. Deleting a form cascades to its upload rows but not to the objects in storage; remove those with the bucket's own tooling if needed.

## Notes

- The build runs translation validation before Next.js production build.
- Response exports are generated inside the app; no separate worker is required.
- Editing a published form updates the live public form immediately.
