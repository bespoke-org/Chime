# Development

This document covers day-to-day local development for Lively Forms.

## Prerequisites

- Bun
- Podman + Podman Compose, or Docker with Compose
- PostgreSQL container support via `compose.yaml`
- ATProto OAuth/client metadata for creator sign-in during local development

## Local setup

```bash
bun install
bun run hooks:install
cp .env.example .env
bun run db:up
bun run prisma:migrate
bun run dev
```

Open `http://127.0.0.1:3000`.

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

Run the full local verification suite used by CI:

```bash
bun run check
```

Run lint only:

```bash
bun run lint
```

Run a production build only:

```bash
bun run build
```

Install git hooks for this repo:

```bash
bun run hooks:install
```

Notes:

- The pre-commit hook runs `bun run check`, which includes formatting, unit tests, linting, type-checking, and a production build.
- `bun run build` also validates translation resources before the Next.js build.
- `bun test` runs the unit tests, `bun run test:e2e` runs the Playwright tests in `e2e/`.
- `bun run deploy` runs `scripts/deploy.sh`, which ships the working tree to the stage host over ssh.

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
