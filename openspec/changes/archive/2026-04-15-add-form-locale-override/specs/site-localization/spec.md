## MODIFIED Requirements

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
