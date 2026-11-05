# Tasks

- [x] Rename product copy, project metadata, links and technical namespaces to Chime.
- [x] Remove deployment-owned emblem and document configuration for organization-specific settings.
- [x] Configure database/container identities and preserve the deployed storage bucket.
- [ ] Add GitHub Actions and exclude local agent artifacts.
- [x] Verify the application, deployment configuration and final diff.

Validation: `bun install --frozen-lockfile` and `bun run check` passed (658 tests, formatting, lint, types, translations and production build). Both Compose files rendered successfully with default and custom database/container identities. Shell syntax passed. The deployment environment update preserved existing configuration, explicit overrides and repeat-run behavior, including database reset configuration. The final source scan found no previous product names or organization emblems. A live deployment has not been performed.
