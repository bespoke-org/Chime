## ADDED Requirements

### Requirement: Creator can configure respondent interface locale per form
The system SHALL allow an authenticated creator to configure a form-level respondent interface locale in form settings for any accessible form. The setting SHALL support a `Use visitor's language` option and any currently supported explicit locale override.

#### Scenario: Creator uses visitor-language mode
- **WHEN** an authenticated creator leaves the respondent interface locale setting on `Use visitor's language`
- **THEN** the system saves the form without an explicit locale override

#### Scenario: Creator selects a supported explicit locale
- **WHEN** an authenticated creator chooses a supported locale such as English or Russian in form settings and saves
- **THEN** the system persists that locale as the form's respondent interface override

#### Scenario: Creator reopens form settings with an existing locale override
- **WHEN** an authenticated creator opens settings for a form that already has a saved respondent interface locale override
- **THEN** the system shows the saved override as the current selected value
