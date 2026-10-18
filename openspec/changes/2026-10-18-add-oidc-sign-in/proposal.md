## Why

Creator sign-in is ATProto only. Deployments inside an organization want creators to use the identity they already have, such as a Keycloak realm, a Google account, or GitHub, and ATProto handles are an obstacle for people who do not have one.

## What Changes

- Add three optional sign-in providers to the Auth.js configuration: Google, GitHub, and a generic OpenID Connect provider (Keycloak is the first target). Each is registered only when its environment variables are set; without them the sign-in page is unchanged.
- Show a button per enabled provider on the sign-in page, in the order Google, GitHub, OpenID Connect, above the ATProto form. Labels are localized, and the OpenID Connect label comes from `OIDC_PROVIDER_NAME`.
- Initialize empty profile fields (name parts, avatar, notification email) from the provider profile on sign-in, with the same "never overwrite creator edits" rule as the ATProto flow.
- Show a localized message for Auth.js OAuth errors on the sign-in page, including the account-not-linked case.
- Document the environment variables and the client setup for Google Cloud Console, GitHub OAuth Apps, and Keycloak.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `creator-auth`: optional OAuth and OpenID Connect providers next to ATProto, with conditional availability and shared profile initialization.

## Impact

- Affected code: `lib/auth.ts` provider list and sign-in event, new `lib/oidc-auth.ts` for environment parsing and profile mapping, `lib/users.ts` shared profile defaults, new `components/auth/provider-sign-in-buttons.tsx`, `app/page.tsx`, `components/auth/auth-error-alert.tsx`, locale files, `.env.example`, `docs/deployment.md`, `README.md`, and tests.
- No new dependencies: the Google and GitHub providers and the generic OAuth provider ship with `next-auth`.
- No schema change: `User`, `Account`, and `Session` rows are created by the existing Prisma adapter.
