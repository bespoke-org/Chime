## ADDED Requirements

### Requirement: Runner renders authored Markdown content consistently
The system SHALL render the supported authored Markdown subset in the public runner wherever question descriptions or text block bodies are shown to respondents.

#### Scenario: Respondent views a formatted text block
- **WHEN** a published form contains a text block body with supported Markdown
- **THEN** the runner shows the formatted body content instead of displaying the Markdown syntax literally

#### Scenario: Respondent views a formatted question description
- **WHEN** a published form contains a question description with supported Markdown
- **THEN** the runner shows the formatted description consistently with the shared authored Markdown rules
