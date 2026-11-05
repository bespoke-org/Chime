# Add CI for Chime

## Goal

Use the shared conventions from `bespoke-org/Tape` for a small GitHub Actions pipeline suited to Next.js, Bun, Prisma and PostgreSQL.

## Scope and constraints

- Run formatting, unit/component tests, lint and generated route type checks separately from database/browser checks.
- Install the locked dependencies with the Node 22 and Bun 1.3.13 toolchain used by the Docker image. Cache Bun's downloaded packages rather than generated clients or installed modules.
- Apply the committed migrations to an isolated PostgreSQL 16 service, then run browser tests on the production build. Existing browser regressions must use real public forms instead of a development-only route.
- Each browser test owns its seeded data and removes only those rows. Require an explicit test database connection.
- Pin actions by SHA, grant read-only repository access, cancel outdated runs and retain test reports and failure diagnostics for seven days.
- Do not publish artifacts externally, deploy, change the production schema or redesign application features.

## Acceptance and verification

The workflow must run on pull requests, pushes to `main` and manual dispatch without deployment secrets. Unit JUnit reports must be nonempty; browser reports must include failure diagnostics. Verify formatting, lint, generated types, unit tests and the production build, then apply all migrations to a disposable local PostgreSQL database and run the Chromium suite with CI settings. Review the relevant diff and document any checks that cannot run locally.
