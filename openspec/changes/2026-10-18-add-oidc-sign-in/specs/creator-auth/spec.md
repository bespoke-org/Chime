## ADDED Requirements

### Requirement: Optional OAuth and OpenID Connect sign-in providers
The system SHALL support Google, GitHub, and one generic OpenID Connect provider as creator sign-in methods next to ATProto. A provider SHALL be available only when all of its environment variables are set: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`; `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET`. The OpenID Connect provider SHALL use the issuer's discovery document, the authorization code flow with PKCE and state, the scope from `OIDC_SCOPE` (default `openid profile email`), and the callback path `/api/auth/callback/oidc`. Successful sign-ins SHALL enter the existing authenticated creator experience and send the creator to the dashboard.

#### Scenario: No provider is configured
- **WHEN** none of the provider variables are set
- **THEN** the sign-in page shows only the ATProto form

#### Scenario: Several providers are configured
- **WHEN** Google, GitHub, and OpenID Connect are configured
- **THEN** the sign-in page shows one button per provider in the order Google, GitHub, OpenID Connect above the ATProto form, labeled "Continue with Google", "Continue with GitHub", and "Continue with <OIDC_PROVIDER_NAME>" in the active locale, with `SSO` as the default name

#### Scenario: Creator signs in with a provider
- **WHEN** a creator completes the provider's authorization flow
- **THEN** the system creates or reuses the account for that provider and provider account id and opens the creator dashboard

#### Scenario: Email already used by another provider
- **WHEN** a creator signs in with a provider whose email belongs to a user created through a different provider
- **THEN** the system does not link the accounts and shows a localized message that the email is already used by another sign-in method

#### Scenario: Provider flow fails
- **WHEN** the provider returns an error or the configuration is invalid
- **THEN** the sign-in page shows a localized generic sign-in error without creating a session

### Requirement: Provider profiles initialize creator profile data
The system SHALL fill empty creator profile fields from the provider profile on sign-in: name parts from the provider name (Google name parts win over splitting the full name, GitHub falls back to the login), the avatar from the provider picture, and the notification email from the provider email. The system SHALL NOT overwrite values the creator has already set.

#### Scenario: First sign-in with a full profile
- **WHEN** a new creator signs in with a provider that returns a name, a picture, and an email
- **THEN** the system stores the name parts, the full name, the avatar, and the lowercased email as the notification email

#### Scenario: Provider returns no email
- **WHEN** a creator signs in with GitHub and the email is hidden
- **THEN** the notification email stays empty

#### Scenario: Returning creator with edited profile
- **WHEN** a creator who edited their name or notification email signs in again
- **THEN** the system keeps the edited values

#### Scenario: Provider user has no locale
- **WHEN** a creator signed in through a provider has no stored locale
- **THEN** the session carries a null locale and the application falls back to the browser language
