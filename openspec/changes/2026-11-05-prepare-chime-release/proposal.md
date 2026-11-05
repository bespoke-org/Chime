# Prepare Chime for public release

## Goal

Publish the shared form builder as Chime at `https://github.com/bespoke-org/Chime`. Replace the previous product identity throughout the tracked source, translations, examples, documentation and specifications. Keep deployment-specific assets and policy outside the shared application.

## Constraints and non-goals

- Retain author credits, the AGPL license and all database migrations.
- Make existing database and storage identities configurable; do not rename live resources or deploy as part of this change.
- Organization-specific SSO labels, icons, access rules and time zones remain environment settings. Do not bundle an organization's emblem.
- No feature redesign, dependency upgrades, release tag or publication.

## Acceptance criteria

- Both interface locales, metadata, error pages, OAuth defaults and repository links identify Chime.
- Package, Compose, webhook headers and browser storage use Chime names, and upgrade notes explain the affected integrations and browser state.
- Existing installations can keep their database, bucket, Compose project and service identities through configuration.
- GitHub Actions runs the repository's quality checks.
- Local agent notes are ignored and excluded from deployment archives and container builds.

## Verification

Run translation validation, the existing unit suite, formatting, lint, type checking and a production build. Validate Compose defaults and custom database/container names, shell syntax and the deployment environment update with an existing database URL. Review the final diff and scan tracked files for the previous product identity and deployment-specific branding.
