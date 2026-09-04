## 1. ATProto auth foundation

- [x] 1.1 Select and add the ATProto OAuth/client dependency and any required storage helpers.
- [x] 1.2 Add ATProto auth configuration parsing for client metadata, redirect URL, public base URL, and required secrets.
- [x] 1.3 Implement auth-start and callback routes for ATProto OAuth with handle/DID input, state/PKCE validation, and recoverable error handling.
- [x] 1.4 Bridge successful ATProto callbacks into existing app `User`, `Account`, and `Session` records using `provider = "atproto"` and the authenticated DID as the provider account ID.

## 2. Profile synchronization

- [x] 2.1 Replace Google-specific profile synchronization types/functions with ATProto/provider-neutral naming.
- [x] 2.2 Fetch AT Protocol actor profile data after authentication and map display name/handle/DID/avatar into existing creator profile fields.
- [x] 2.3 Preserve creator-managed profile fields, email, image overrides, and locale on repeated ATProto sign-ins.
- [x] 2.4 Add unit coverage for ATProto profile initialization, fallback identity values, invalid avatar handling, and preservation behavior.

## 3. User-facing sign-in experience

- [x] 3.1 Replace the Google sign-in button with an ATProto/PDS sign-in form that accepts a handle or DID and starts the auth flow.
- [x] 3.2 Update English and Russian localization keys/copy from Google sign-in to ATProto/PDS sign-in.
- [x] 3.3 Update auth troubleshooting and profile settings help text to describe ATProto profile/avatar initialization.

## 4. Documentation and verification

- [x] 4.1 Update deployment and development docs with ATProto OAuth/client metadata setup and callback URLs.
- [x] 4.2 Search the codebase for remaining user-facing Google OAuth references and remove or intentionally retain them.
- [x] 4.3 Run formatting, tests, lint, typecheck, and build checks.
- [x] 4.4 Manually verify sign-in with a real ATProto identity routes to `/dashboard` and creates an `atproto` account row.
