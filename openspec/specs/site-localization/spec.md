## ADDED Requirements

### Requirement: Application strings resolve from locale resource files
The system SHALL resolve user-facing application strings from locale-specific YAML resource files using stable translation labels instead of embedding final copy directly in code.

#### Scenario: App renders a labeled string
- **WHEN** a creator or respondent opens a surface that uses localized copy
- **THEN** the system resolves the requested label from the active locale resource file before rendering the text

#### Scenario: App adds a second supported language
- **WHEN** a supported locale file exists with the same translation labels as the default locale
- **THEN** the system can render that surface in the additional language without requiring the component to hardcode translated copy

### Requirement: Supported locale resolution falls back to English
The system SHALL support `en` and `ru` locales initially and SHALL normalize unsupported locale values to English. For public form surfaces, the system SHALL honor a saved supported form-level locale override before using browser or user-state locale detection.

#### Scenario: Supported locale is requested
- **WHEN** the active locale is `en` or `ru`
- **THEN** the system renders strings from that supported locale resource set

#### Scenario: Public form has a supported locale override
- **WHEN** a public form surface is loaded for a form whose saved locale override is `en` or `ru`
- **THEN** the system uses that saved form locale for rendering instead of browser locale detection

#### Scenario: Unauthenticated user has a supported browser locale
- **WHEN** an unauthenticated creator or respondent opens the app and no form-level locale override applies while the browser locale resolves to a supported locale
- **THEN** the system uses that supported browser locale for rendering without requiring sign-in

#### Scenario: Unsupported locale is requested
- **WHEN** the system receives an unsupported locale value from user state, OAuth data, environment detection, or a saved form override
- **THEN** the system falls back to English as the active locale

### Requirement: Missing translations are surfaced during build
The system SHALL compare locale resource files against the default label set during build and SHALL emit warnings listing missing translation labels.

#### Scenario: Locale file is missing labels
- **WHEN** a non-default locale file does not contain one or more labels present in the default locale file
- **THEN** the build process warns with the missing labels for that locale

#### Scenario: Locale files are complete
- **WHEN** each supported locale file contains the required translation labels
- **THEN** the build process completes without missing-translation warnings
