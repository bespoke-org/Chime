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
- `bun test` runs the unit/component tests. `bun run typecheck` generates Next.js route types before TypeScript checks, so it also works on a fresh checkout.
- GitHub Actions runs two jobs: `check` for formatting, unit tests, lint and types; `e2e` for PostgreSQL migrations, a production build and Chromium tests. It uses Node 22 and Bun 1.3.13, matching the Docker image. Test reports and browser failure diagnostics are retained for seven days.
- CI caches Bun's downloaded packages, then always installs from `bun.lock`; installed modules, Prisma clients and browser binaries are not cached.
- `bun run deploy` runs `scripts/deploy.sh`, which ships the working tree over ssh to the host in `DEPLOY_HOST` (the author's setup, see [deployment.md](./deployment.md)).

### Browser tests

Playwright uses real published forms in an isolated PostgreSQL database. Each test creates its own owner and form and removes those rows afterwards. `E2E_DATABASE_URL` is required explicitly; the tests do not fall back to the app's usual database connection.

For example, start a disposable PostgreSQL instance on a separate port:

```bash
docker run --rm --name chime-e2e \
  -e POSTGRES_USER=chime -e POSTGRES_PASSWORD=chime -e POSTGRES_DB=chime_test \
  -p 127.0.0.1:55432:5432 -d postgres:16-alpine
export E2E_DATABASE_URL="postgresql://chime:chime@127.0.0.1:55432/chime_test?schema=public"
DATABASE_URL="$E2E_DATABASE_URL" bun x --no-install prisma migrate deploy
bun x --no-install playwright install chromium
DATABASE_URL="$E2E_DATABASE_URL" bun run build
bun run test:e2e
docker stop chime-e2e
```

Playwright starts `next start` on port 3100 and waits for it automatically; `PLAYWRIGHT_PORT` overrides the port. Set `PLAYWRIGHT_BASE_URL` only when managing the test server yourself; it must use the same test database. CI requires a fresh server, rejects focused tests (`test.only`), uses one worker and allows two retries with a trace on the first retry and screenshots on failures. A test that passes only on retry still fails CI, so retries collect diagnostics without hiding flakiness. Locally tests run without retries. The test suite has a five-minute global limit in CI, leaving time to upload reports before the job timeout.

The setup follows the [Next.js Playwright guide](https://nextjs.org/docs/app/guides/testing/playwright), [Playwright CI guidance](https://playwright.dev/docs/ci-intro), and [Bun's CI installation guidance](https://bun.sh/docs/pm/cli/install#cicd).

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
