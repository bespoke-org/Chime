## ADDED Requirements

### Requirement: Creator can configure respondent back navigation per form
The system SHALL allow an authenticated creator to configure whether respondents may navigate backward to earlier visited steps in the public form runner for any accessible form. The setting SHALL default to enabled for existing and newly created forms unless the creator explicitly disables it.

#### Scenario: Creator leaves back navigation enabled
- **WHEN** an authenticated creator keeps the respondent back-navigation setting enabled and saves form settings
- **THEN** the system persists the form with respondent back navigation allowed

#### Scenario: Creator disables back navigation
- **WHEN** an authenticated creator disables respondent back navigation in form settings and saves
- **THEN** the system persists the form so respondents can continue forward but cannot return to earlier visited steps in the public runner

#### Scenario: Creator reopens form settings with back navigation disabled
- **WHEN** an authenticated creator opens settings for a form that already has respondent back navigation disabled
- **THEN** the system shows the saved disabled state as the current value
