## 1. Provider configuration

- [x] 1.1 Add `lib/oidc-auth.ts` with `getOidcConfig`, `getGoogleConfig`, `getGithubConfig`, `getSignInProviderOptions`, `mapOidcProfile`, and `getExternalProfile`
- [x] 1.2 Register Google, GitHub, and the generic OpenID Connect provider in `lib/auth.ts` only when configured
- [x] 1.3 Add tests for required variables, defaults, trailing slash, provider order, and profile mapping

## 2. Profile initialization

- [x] 2.1 Extract `applyProfileDefaults` in `lib/users.ts` and add `syncExternalProfileFields` with `notificationEmail`
- [x] 2.2 Call it from `events.signIn` for the new providers
- [x] 2.3 Add tests for the first sign-in, provided name parts, a missing email, and preserved creator edits

## 3. Sign-in page

- [x] 3.1 Add `ProviderSignInButtons` and render it above the ATProto form with the enabled providers from the server
- [x] 3.2 Map Auth.js `error` codes to localized messages and clear the parameter after showing it
- [x] 3.3 Add copy to `en.yml` and `ru.yml`
- [x] 3.4 Add tests for no providers, labels, the `signIn("oidc", { callbackUrl })` call, and the Russian label

## 4. Documentation

- [x] 4.1 Add the variables to `.env.example` and `docs/deployment.md`
- [x] 4.2 Describe the Google Cloud Console, GitHub OAuth App, and Keycloak client setup and the separate-accounts rule
- [x] 4.3 Mention the providers in `README.md`
- [ ] 4.4 Verify a real sign-in against the Keycloak realm, Google, and GitHub on a deployment
