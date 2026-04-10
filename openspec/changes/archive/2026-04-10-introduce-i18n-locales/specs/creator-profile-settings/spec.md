## ADDED Requirements

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
