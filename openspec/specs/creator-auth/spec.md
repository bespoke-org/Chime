## ADDED Requirements

### Requirement: Creator authentication gates creator features
The system SHALL require authentication before a user can access creator-only features, including creating forms, editing owned forms, publishing forms, and reviewing responses.

#### Scenario: Unauthenticated user opens creator dashboard
- **WHEN** an unauthenticated user navigates to a creator-only route
- **THEN** the system redirects them to sign in before showing creator functionality

#### Scenario: Authenticated creator opens creator dashboard
- **WHEN** an authenticated creator navigates to a creator-only route
- **THEN** the system grants access to creator functionality associated with their account

### Requirement: Creator ownership is enforced for managed forms
The system SHALL allow creators to manage personal forms they own and organization forms belonging to organizations where they are members, and SHALL prevent access to editing, publishing, response review, or response export for forms outside those accessible workspaces.

#### Scenario: Creator opens a personal form they own
- **WHEN** an authenticated creator requests a personal form they own
- **THEN** the system allows them to edit and manage that form

#### Scenario: Creator opens an organization form in a joined organization
- **WHEN** an authenticated creator requests a form belonging to an organization where they are a member
- **THEN** the system allows them to manage that form according to organization membership access

#### Scenario: Creator opens another creator's inaccessible form
- **WHEN** an authenticated creator requests a form they do not own personally and that does not belong to an organization they are part of
- **THEN** the system denies access to form management, response review, and response export for that form

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
