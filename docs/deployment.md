# Deployment and environment setup

This project is a Next.js app backed by PostgreSQL and Auth.js with Google OAuth.

## Required environment variables

Copy `.env.example` to `.env` and provide values for:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="replace-with-a-long-random-string"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a strong auth secret, for example:

```bash
openssl rand -base64 32
```

## Local development setup

### 1. Install dependencies

```bash
bun install
```

### 2. Start PostgreSQL

```bash
bun run db:up
```

This uses `compose.yaml` and starts Postgres on `localhost:5432`.

### 3. Run Prisma migrations

```bash
bun run prisma:migrate
```

### 4. Start the app

```bash
bun run dev
```

## Google OAuth setup

Create your own Google OAuth client in Google Cloud Console.

### Local OAuth settings

Use these values during local development:

**Authorized JavaScript origins**
- `http://localhost:3000`

**Authorized redirect URIs**
- `http://localhost:3000/api/auth/callback/google`

If these values are missing or incorrect, Google sign-in will fail.

### Production OAuth settings

For a deployed environment, replace `localhost` with your real domain.

Example:

**Authorized JavaScript origins**
- `https://your-domain.example`

**Authorized redirect URIs**
- `https://your-domain.example/api/auth/callback/google`

Set `NEXTAUTH_URL` to the same public base URL.

## Production deployment checklist

1. Provision a PostgreSQL database.
2. Set the required environment variables.
3. Configure Google OAuth for the production domain.
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
