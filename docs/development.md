# Development

This document covers day-to-day local development for Lively Forms.

## Prerequisites

- Bun
- Podman + Podman Compose
- PostgreSQL container support via `compose.yaml`
- A Google OAuth client for creator sign-in during local development

## Local setup

```bash
bun install
cp .env.example .env
bun run db:up
bun run prisma:migrate
bun run dev
```

Open `http://localhost:3000`.

For environment variables and OAuth setup details, see [deployment.md](./deployment.md).

## Daily workflow

### Start the database

```bash
bun run db:up
```

### Start the app

```bash
bun run dev
```

### Stop the database

```bash
bun run db:down
```

### View database logs

```bash
bun run db:logs
```

### Reset the local database volume

```bash
bun run db:reset
```

## Database workflow

Generate Prisma client after schema changes:

```bash
bun run prisma:generate
```

Create and apply a local migration during development:

```bash
bun run prisma:migrate
```

Open Prisma Studio:

```bash
bun run prisma:studio
```

## Quality checks

Run lint:

```bash
bun run lint
```

Run a production build:

```bash
bun run build
```

Notes:

- `bun run build` also validates translation resources before the Next.js build.
- There is currently no separate test suite command in `package.json`.

## Important directories

- `app/` — App Router pages, layouts, and API routes
- `components/` — UI and feature components
- `lib/` — business logic, auth, forms, branching, i18n, exports
- `locales/` — translation YAML files
- `prisma/` — schema and migrations
- `docs/` — project documentation
- `openspec/` — product/spec workflow artifacts

## Important files

- `lib/blocks.ts` — block types, config parsing, branch operator support
- `lib/branching.ts` — branching resolution and validation helpers
- `lib/forms.ts` — form loading, publish flow, submission shaping, response access
- `components/form-builder.tsx` — creator builder shell
- `components/form-builder-panels.tsx` — block settings and branching controls
- `components/public-form-runner.tsx` — public respondent flow

## Notes for contributors

- Use `bun` commands for project workflows.
- Creator routes require authentication; public form routes do not.
- Responses are stored anonymously.
- Editing a published form updates the live public form immediately.
- When changing UI copy, update both `locales/en.yml` and `locales/ru.yml`.
