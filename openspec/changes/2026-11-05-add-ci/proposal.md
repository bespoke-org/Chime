# Add CI for Chime

## Goal

Use the shared conventions from `bespoke-org/Tape` for a small GitHub Actions pipeline suited to Next.js, Bun, Prisma and PostgreSQL.

## Scope and constraints

- Run three independent jobs: static checks (`lint`), isolated unit/component tests (`unit`), and database/browser checks (`e2e`). Pin the runner to Ubuntu 24.04 for compatibility with the locked Playwright version.
- Install the locked dependencies with the Node 22 and Bun 1.3.13 toolchain used by the Docker image. Cache Bun's downloaded packages rather than generated clients or installed modules.
- Apply the committed migrations to an isolated PostgreSQL 16 service, then run browser tests on the production build. Existing browser regressions must use real public forms instead of a development-only route.
- Each browser test owns its seeded data and removes only those rows. Require an explicit test database connection.
- Pin actions by SHA, grant read-only repository access, cancel outdated runs and retain test reports and failure diagnostics for seven days.
- Do not publish artifacts externally, deploy, change the production schema or redesign application features.

## Acceptance and verification

The workflow must run on pull requests, pushes to `main` and manual dispatch without deployment secrets. Unit JUnit reports must be nonempty; browser reports must include failure diagnostics. Verify formatting, lint, generated types, unit tests and the production build, then apply all migrations to a disposable local PostgreSQL database and run the Chromium suite with CI settings. Review the relevant diff and document any checks that cannot run locally.

## Initial hosted failures

The first run exposed module mocks leaking between test files, an OAuth helper test importing a Node-only Undici dependency under Bun, and `ubuntu-latest` selecting Ubuntu 26.04, unsupported by the locked Playwright version. Run Bun tests with per-file isolation, test the unchanged pure OAuth helpers through a dependency-free module, and pin Ubuntu 24.04. Existing OAuth exports remain available to callers. The failing test order is reproduced with `bun test --randomize --seed 1 lib/atproto-auth-callback.test.ts lib/users.test.ts`; the isolated test command must pass that same order.
