## ADDED Requirements

### Requirement: Public form runner honors form-specific interface locale overrides
The system SHALL resolve respondent-facing interface strings for a public form from the form's saved locale override when one is configured. When no override is configured, the system SHALL continue using the existing automatic locale-detection flow.

#### Scenario: Respondent opens a form with a Russian locale override
- **WHEN** a respondent opens a published form whose saved respondent interface locale override is `ru`
- **THEN** the public runner renders navigation, validation, progress, and completion interface strings in Russian regardless of the respondent's browser locale

#### Scenario: Respondent opens a form with no locale override
- **WHEN** a respondent opens a published form that has no saved respondent interface locale override
- **THEN** the public runner resolves interface strings using the existing automatic locale-detection behavior
