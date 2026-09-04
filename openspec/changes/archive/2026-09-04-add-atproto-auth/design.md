## Context

Creator authentication currently uses NextAuth/Auth.js with the Prisma adapter and the Google OAuth provider. Authenticated creator access, ownership checks, account menu behavior, and locale lookup all depend on the existing `User`, `Account`, and `Session` records rather than on Google-specific APIs after sign-in.

ATProto OAuth is not a simple fixed-issuer OAuth provider: users identify with a handle or DID, clients resolve the identity/PDS, and profile data is fetched from AT Protocol records after authorization. The implementation should keep the app's existing database-backed creator session model while replacing the external sign-in flow and profile initialization source.

## Goals / Non-Goals

**Goals:**
- Let creators sign in with an ATProto identity associated with their PDS.
- Store/link the authenticated ATProto DID as the provider account identifier.
- Initialize missing creator display name/name parts and avatar from AT Protocol profile data.
- Preserve manually edited profile fields and locale on later sign-ins.
- Update product copy and deployment docs so operators configure ATProto OAuth instead of Google OAuth.

**Non-Goals:**
- Supporting Google and ATProto side by side in the first version.
- Migrating existing Google `Account` rows to ATProto accounts automatically.
- Adding posting, repo writes, Bluesky social features, or long-lived ATProto API access beyond authentication/profile lookup.
- Persisting the user's PDS endpoint as a first-class profile setting unless needed by the OAuth client library.
- Inferring app locale from ATProto profile data.

## Decisions

### Use an ATProto OAuth client flow rather than a static NextAuth OAuth provider

Implement ATProto sign-in with `@atproto/oauth-client-node` so the app gets handle/DID resolution, PDS authorization-server discovery, PKCE/state handling, and callback validation. The landing page will ask for or accept an ATProto handle/PDS identity, start the OAuth flow, and route the callback through app-owned auth endpoints.

Alternative considered: model ATProto as a static NextAuth OAuth provider. This is simpler in the current auth configuration shape, but it does not fit ATProto's dynamic identity/PDS discovery model reliably.

### Preserve the existing app session and authorization model

After a successful ATProto OAuth callback, upsert the app user/account using the ATProto DID as `Account.providerAccountId` with `provider = "atproto"`, then create the same kind of app session currently used for creator routes. Existing creator authorization code should continue to call the same session helpers and ownership checks.

Alternative considered: replace NextAuth/Auth.js entirely. That would make the ATProto flow more direct but would force a larger rewrite of creator route protection, account menus, test setup, and database session handling.

### Fetch profile data from AT Protocol after identity is established

Fetch the actor profile for the authenticated DID/handle and map `displayName` into `name`, `firstName`, and `secondName` using the existing name-splitting behavior. Map `avatar` into `image` only if it is a usable URL. If no display name is available, fall back to the handle or DID for safe identity display.

Alternative considered: only trust OAuth claims. ATProto OAuth identity claims may not include the same user-facing profile fields the app needs for creator display, so fetching profile data gives a better first-run experience.

### Keep profile synchronization additive only

ATProto sign-in should initialize missing fields but must not overwrite creator-edited `name`, `firstName`, `secondName`, `image`, `email`, or `locale` values. Locale should continue to follow the app's default/user-setting behavior because ATProto profile data does not define the same locale source as the current Google flow.

Alternative considered: overwrite the profile on every sign-in to stay synced with ATProto. That would surprise creators who use the app's profile settings as the source of truth.

### Use ATProto-specific configuration and copy

Replace Google-specific environment guidance and UI copy with ATProto/PDS sign-in language. Configuration should document the public client metadata/client ID, redirect URL, and any server URL/base URL values required by the ATProto OAuth client implementation. Local loopback development uses the ATProto `http://localhost?...` client ID convention with a `127.0.0.1` redirect URI; production deployments use an HTTPS client metadata URL.

Alternative considered: keep existing Google variable names as generic OAuth placeholders. This would be misleading for deployments and makes troubleshooting harder.

## Risks / Trade-offs

- ATProto OAuth client support may require an additional dependency and route-level state storage → choose a maintained ATProto OAuth client package and keep auth state in durable storage or secure cookies as required by the library.
- Existing Google-only users cannot automatically become the same user through ATProto → document that deployments need account linking/backfill if identity continuity matters.
- PDS or handle resolution failures can block sign-in → show clear validation and retry errors before redirecting or after callback failure.
- Avatar URLs may be CDN/blob URLs that change or expire → store only usable profile image URLs and allow creators to override them in settings.
- A custom auth flow can drift from NextAuth internals → isolate bridge code that creates/updates `User`, `Account`, and `Session` records and cover it with focused tests.

## Migration Plan

1. Add ATProto OAuth/client configuration to development and production environments.
2. Deploy the ATProto sign-in flow and updated copy/docs.
3. Verify sign-in with a real ATProto handle creates or reuses an `Account` row with `provider = "atproto"` and routes the creator to `/dashboard`.
4. Verify missing profile fields are initialized from AT Protocol profile data and creator-edited fields remain unchanged on subsequent sign-ins.
5. Roll back by redeploying the prior Google-provider version and restoring Google OAuth configuration if ATProto sign-in fails.

## Open Questions

- Manual verification still needs to complete a real ATProto authorization flow and confirm the resulting `atproto` account row.
