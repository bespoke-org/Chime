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
```

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

## Notes

- The build runs translation validation before Next.js production build.
- Response exports are generated inside the app; no separate worker is required.
- Editing a published form updates the live public form immediately.
