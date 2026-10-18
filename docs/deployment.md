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

## Notes

- The build runs translation validation before Next.js production build.
- Response exports are generated inside the app; no separate worker is required.
- Editing a published form updates the live public form immediately.
