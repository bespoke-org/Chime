## ADDED Requirements

### Requirement: Authenticated creator can manage profile details in settings
The system SHALL provide a Profile section within authenticated creator settings where a signed-in user can review and update their first name and second name.

#### Scenario: Creator updates profile names
- **WHEN** an authenticated creator saves new first-name or second-name values in the Profile section
- **THEN** the system persists the updated values for that user and uses them in creator-facing identity displays

#### Scenario: Creator opens profile settings
- **WHEN** an authenticated creator opens settings
- **THEN** the system shows a Profile section with editable profile fields for that user's account

### Requirement: Authenticated creator can manage their profile image
The system SHALL allow a signed-in creator to set or replace the profile image used for creator-facing identity surfaces.

#### Scenario: Creator sets a profile image
- **WHEN** an authenticated creator provides a valid profile image value in profile settings and saves it
- **THEN** the system stores that image for the user account and uses it in creator-facing avatar displays

#### Scenario: Creator replaces an existing profile image
- **WHEN** an authenticated creator updates a previously stored profile image
- **THEN** the system uses the new image in place of the previous one across creator-facing identity surfaces

### Requirement: Authenticated creator can manage locale preference in profile settings
The system SHALL allow a signed-in creator to view and update their language preference from the Profile section in settings.

#### Scenario: Creator opens profile settings
- **WHEN** an authenticated creator opens the Profile section in settings
- **THEN** the system shows the current language preference and the supported locale choices

#### Scenario: Creator switches to Russian
- **WHEN** an authenticated creator selects Russian in profile settings and saves the change
- **THEN** the system persists the `ru` locale preference and uses it for subsequent localized app rendering

#### Scenario: Creator switches to English
- **WHEN** an authenticated creator selects English in profile settings and saves the change
- **THEN** the system persists the `en` locale preference and uses it for subsequent localized app rendering
