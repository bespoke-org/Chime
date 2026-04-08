# Lively Forms

Lively Forms is a Typeform-inspired conversational form builder built with Next.js, Auth.js, Prisma, PostgreSQL, Tailwind, Framer Motion, and dnd-kit.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style local primitives
- Framer Motion
- dnd-kit
- Auth.js (`next-auth`) with Google OAuth for creators
- Prisma + PostgreSQL
- Podman Compose for local Postgres

## Local setup

### 1. Install dependencies

```bash
bun install
```

### 2. Start Postgres with Podman

```bash
bun run db:up
```

This uses `compose.yaml` and starts a local Postgres container on `localhost:5432`.

### 3. Create local env file

```bash
cp .env.example .env
```

Fill in:
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `NEXTAUTH_URL` (keep `http://localhost:3000` for local dev)

Generate a secret, for example:

```bash
openssl rand -base64 32
```

### 4. Configure Google OAuth for local development

Yes — Google OAuth can work locally, but you must create your own OAuth client in Google Cloud and allow localhost.

In Google Cloud Console:

1. Open **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID**
3. Choose **Web application**
4. Add these local settings:

**Authorized JavaScript origins**
- `http://localhost:3000`

**Authorized redirect URIs**
- `http://localhost:3000/api/auth/callback/google`

Then copy the generated values into `.env`:

```env
AUTH_GOOGLE_ID="your-client-id"
AUTH_GOOGLE_SECRET="your-client-secret"
```

If these values are missing or wrong, Google will show:
- `Error 401: invalid_client`
- `The OAuth client was not found`

### 5. Run Prisma migration

```bash
bun run prisma:migrate
```

### 6. Start the app

```bash
bun run dev
```

Open `http://localhost:3000`.

## Useful commands

```bash
bun run dev
bun run build
bun run lint
bun run db:up
bun run db:down
bun run db:logs
bun run prisma:generate
bun run prisma:migrate
bun run prisma:studio
```

## Product surfaces

### Creator app
- `/login`
- `/dashboard`
- `/forms/[id]/edit`
- `/forms/[id]/responses`
- `/forms/[id]/responses/[responseId]`

### Public app
- `/f/[slug]`

## Current v0 scope

- Creator Google sign-in
- Owned form dashboard
- Master-detail builder
- Block types:
  - text
  - short text
  - long text
  - single choice
  - multiple choice
- Publish / unpublish
- Anonymous public submissions
- Responses list and detail views

## Notes

- Creator auth is used only for creating, editing, publishing, and reviewing forms.
- Public respondents do not log in.
- Responses are stored anonymously.
- Editing a published form updates the live public form immediately in v0.
