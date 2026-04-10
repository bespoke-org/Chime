## MODIFIED Requirements

### Requirement: Authenticated identity initializes profile data from Google when available
The system SHALL use Google OAuth profile data to initialize missing creator identity fields, including profile image, available name data, and locale when available, without overwriting profile values the user has already edited.

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

### Requirement: Creator shell exposes avatar-based account access
The system SHALL show the current creator identity in the navbar as an avatar trigger that opens account actions including Settings and Log out.

#### Scenario: Creator views the creator navbar
- **WHEN** an authenticated creator is in the creator experience
- **THEN** the system shows the creator avatar in the navbar using the current profile image or a fallback identity treatment

#### Scenario: Creator opens the account menu
- **WHEN** an authenticated creator activates the avatar trigger in the navbar
- **THEN** the system shows account actions for navigating to Settings and logging out
