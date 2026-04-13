## ADDED Requirements

### Requirement: Response review renders authored Markdown context consistently
The system SHALL render the supported authored Markdown subset in creator-facing response review surfaces wherever question descriptions or text block bodies are shown as form context.

#### Scenario: Creator reviews a response with formatted question context
- **WHEN** an authenticated creator opens a response that includes a question description with supported Markdown
- **THEN** the response review UI shows the formatted description instead of raw Markdown syntax

#### Scenario: Creator reviews a response with formatted text block context
- **WHEN** an authenticated creator opens a response or question summary that includes a text block body with supported Markdown
- **THEN** the response review UI shows the formatted text block content consistently with the shared authored Markdown rules
