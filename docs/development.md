# Development

This document covers day-to-day local development for Chime.

## Prerequisites

- Bun
- Podman + Podman Compose, or Docker with Compose
- PostgreSQL and Garage containers via `compose.yaml`
- ATProto OAuth/client metadata for creator sign-in during local development

## Local setup

```bash
bun install
bun run hooks:install
cp .env.example .env
bun run db:up
bun run prisma:migrate
bun run storage:init
bun run dev
```

Open `http://127.0.0.1:3000`.

`bun run storage:init` prepares the Garage container for file uploads and prints the `S3_*` lines to paste into `.env`; see [File uploads](#file-uploads).

For environment variables and OAuth setup details, see [deployment.md](./deployment.md).

## Daily workflow

### Start the database and object storage

```bash
bun run db:up
```

This starts Postgres on `127.0.0.1:5432` and Garage with its S3 API on `127.0.0.1:3900`.

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

## File uploads

The `FILE_UPLOAD` block stores files in S3-compatible object storage. Locally this is [Garage](https://garagehq.deuxfleurs.fr) (`dxflrs/garage:v2.4.1` in `compose.yaml`), configured by `garage/garage.toml` as a single node with `replication_factor = 1` and a sqlite metadata store. The app only speaks the S3 API with path-style addressing, so any other S3 service works the same way.

After the first `bun run db:up`:

```bash
bun run storage:init
```

The script (`scripts/garage-init.sh`) assigns the node to the layout, creates the `chime` bucket and a key with read, write and owner permissions, sets a CORS rule for `http://127.0.0.1:3000` through `scripts/garage-cors.ts`, and prints the `S3_*` variables for `.env`. Running it again is harmless. Set `UPLOAD_CORS_ORIGIN` before running it if the app is served from another origin.

The browser uploads straight to Garage with a presigned URL, so the origin must be allowed by the bucket's CORS rule or the PUT fails in the browser with a CORS error while `curl` succeeds.

Abandoned uploads (requested but never submitted) are removed by:

```bash
bun run uploads:cleanup
```

`bun run db:reset` also wipes the Garage volumes, so `bun run storage:init` has to run again afterwards.

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
- `bun run deploy` runs `scripts/deploy.sh`, which ships the working tree over ssh to the host in `DEPLOY_HOST` (the author's setup, see [deployment.md](./deployment.md)).

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
- `lib/uploads.ts` — file upload validation, verification and cleanup rules
- `lib/object-storage.ts` — S3 client and presigned URLs
- `components/form-builder.tsx` — creator builder shell
- `components/form-builder-panels.tsx` — block settings and branching controls
- `components/public-form-runner.tsx` — public respondent flow

## Notes for contributors

- Use `bun` commands for project workflows.
- Creator routes require authentication; public form routes do not.
- Responses are stored anonymously.
- Editing a published form updates the live public form immediately.
- When changing UI copy, update both `locales/en.yml` and `locales/ru.yml`.
