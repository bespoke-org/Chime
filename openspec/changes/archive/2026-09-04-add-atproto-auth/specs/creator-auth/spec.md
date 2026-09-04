## ADDED Requirements

### Requirement: Creator sign-in uses ATProto OAuth
The system SHALL offer ATProto OAuth as the creator sign-in provider and SHALL route successful ATProto sign-ins into the existing authenticated creator experience.

#### Scenario: Unauthenticated creator starts ATProto sign-in
- **WHEN** an unauthenticated user starts creator sign-in with an ATProto handle, DID, or PDS-backed identity
- **THEN** the system starts the ATProto OAuth flow for that identity

#### Scenario: ATProto sign-in succeeds
- **WHEN** ATProto OAuth completes successfully for a creator
- **THEN** the system authenticates the creator and sends them to the creator dashboard

#### Scenario: Sign-in action is localized
- **WHEN** the sign-in page is shown in a supported locale
- **THEN** the system labels the action as continuing with ATProto or a PDS-backed account in the active locale

#### Scenario: ATProto sign-in cannot resolve identity
- **WHEN** a user submits an ATProto identity that cannot be resolved or authorized
- **THEN** the system shows a recoverable sign-in error without creating an authenticated creator session

### Requirement: Authenticated identity initializes profile data from ATProto when available
The system SHALL use AT Protocol profile data to initialize missing creator identity fields, including profile image and available display name data, without overwriting profile values the user has already edited.

#### Scenario: New creator signs in with ATProto profile data
- **WHEN** a user signs in with ATProto and their stored profile fields are missing
- **THEN** the system stores available AT Protocol display name and avatar data on the user record for creator-facing identity use

#### Scenario: ATProto profile includes only partial identity data
- **WHEN** a user signs in with ATProto and AT Protocol provides only a handle, DID, display name, or avatar subset
- **THEN** the system initializes only the creator identity fields that can be derived safely from the available AT Protocol data

#### Scenario: ATProto profile has no locale source
- **WHEN** a user signs in with ATProto and has no stored locale preference
- **THEN** the system uses the application default locale behavior instead of expecting an AT Protocol locale value

#### Scenario: Returning creator signs in after editing profile settings
- **WHEN** a returning creator signs in with ATProto after manually updating their profile fields or locale preference
- **THEN** the system preserves the creator-managed profile values instead of replacing them with provider values

## REMOVED Requirements

### Requirement: Authenticated identity initializes profile data from Google when available
**Reason**: Creator authentication is switching from Google OAuth to ATProto OAuth, so Google-specific profile initialization is no longer part of the authentication contract.

**Migration**: Use ATProto OAuth profile initialization instead. Deployments must configure ATProto OAuth/client metadata before enabling this change.

#### Scenario: New creator signs in with Google
- **WHEN** a user signs in with Google and their stored profile fields are missing
- **THEN** the system stores available Google name and profile image data on the user record for creator-facing identity use

#### Scenario: New creator signs in with a supported Google locale
- **WHEN** a user signs in with Google, has no stored locale preference, and Google provides a supported locale
- **THEN** the system stores that supported locale on the user record for future app localization

#### Scenario: New creator signs in with an unsupported Google locale
- **WHEN** a user signs in with Google, has no stored locale preference, and Google provides an unsupported locale
- **THEN** the system stores or resolves English as the default locale for that user

#### Scenario: Returning creator signs in after editing profile settings
- **WHEN** a returning creator signs in with Google after manually updating their profile fields or locale preference
- **THEN** the system preserves the creator-managed profile values instead of replacing them with provider values
