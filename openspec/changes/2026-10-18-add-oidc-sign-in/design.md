## Context

The ATProto flow in `lib/atproto-auth.ts` bypasses Auth.js providers and writes `User`, `Account`, and `Session` rows itself, because ATProto discovers the authorization server per user. `authOptions` in `lib/auth.ts` already has the Prisma adapter, database sessions, and a `session` callback that copies `firstName`, `secondName`, and `locale` onto the session. Its `providers` array is empty. `syncAtprotoProfileFields` in `lib/users.ts` fills empty profile fields from the ATProto profile and leaves edited values alone.

## Goals / Non-Goals

**Goals:**
- Let a deployment enable Google, GitHub, and one OpenID Connect provider by environment variables alone.
- Keep the ATProto flow untouched.
- Reuse the Prisma adapter so Auth.js creates the account rows for the new providers.
- Fill empty profile fields from the provider profile the same way the ATProto flow does, and also set the notification email from the provider email.

**Non-Goals:**
- Linking accounts from different providers by email (`allowDangerousEmailAccountLinking` stays off).
- More than one OpenID Connect provider at a time.
- Reading the creator's locale from the provider; the session callback keeps falling back to the browser language when `locale` is null.

## Decisions

### 1. Environment parsing in a pure module
`lib/oidc-auth.ts` exports `getOidcConfig(env)`, `getGoogleConfig(env)`, `getGithubConfig(env)`, and `getSignInProviderOptions(env)`. A provider is enabled only when all of its required variables are non-blank. `getOidcConfig` trims a trailing slash from the issuer and applies the defaults `SSO` for the name and `openid profile email` for the scope. The functions take `env` as a parameter so they are unit-tested without touching `process.env`.

**Why:** the same decision ("is this provider configured") is needed in `lib/auth.ts` to register the provider and in `app/page.tsx` to render the button. One function keeps the two in step and the page never sees the secret: it receives only `{ id, label }` pairs.

### 2. Built-in providers for Google and GitHub, a generic OAuth provider for OpenID Connect
Google and GitHub use `next-auth/providers/google` and `next-auth/providers/github`. The OpenID Connect provider is an inline `type: "oauth"` config with `id: "oidc"`, `wellKnown: <issuer>/.well-known/openid-configuration`, `idToken: true`, `checks: ["pkce", "state"]`, and the scope from the config. `mapOidcProfile` maps `sub` to `id`, `name` or `preferred_username` to `name`, `email`, and `picture` to `image`.

**Why:** discovery handles the endpoint URLs, and reading the id token avoids a userinfo call. The fixed id gives a stable callback path, `/api/auth/callback/oidc`, that operators can register once.

**Alternatives considered:**
- `next-auth/providers/keycloak`: it is the same generic provider with a fixed id and name; the generic one also fits other issuers.

### 3. Profile initialization in the `signIn` event
`events.signIn` in `lib/auth.ts` maps the raw provider profile with `getExternalProfile(provider, profile)` and calls `syncExternalProfileFields`. Both it and `syncAtprotoProfileFields` delegate to a private `applyProfileDefaults` in `lib/users.ts` that fills `firstName`, `secondName`, `name`, `image`, and now `notificationEmail` only when the stored value is empty. Google supplies `given_name` and `family_name`, which win over splitting `name`; GitHub falls back to `login` when `name` is null and may give no email, in which case `notificationEmail` stays empty.

**Why:** the event runs on every sign-in, which also covers users created before this change and keeps the ATProto behavior byte-for-byte the same (its tests did not change).

**Alternatives considered:**
- `events.createUser`: it has no access to the provider profile.

### 4. Errors on the sign-in page
Auth.js redirects failures to `pages.signIn` with `?error=<code>`. `app/page.tsx` maps `OAuthAccountNotLinked` to a message that says the email is already used by another sign-in method and every other code to a generic one; the existing `authError` parameter from the ATProto flow keeps its message. `AuthErrorAlert` removes both parameters from the URL after rendering.

## Risks / Trade-offs

- A provider that returns no `email` creates a user with `email: null`; a second such user from another provider is fine because the unique constraint allows multiple nulls.
- Discovery is fetched at the first sign-in, so an unreachable issuer surfaces as `OAuthCallback` or `Configuration` on the page rather than at boot.
