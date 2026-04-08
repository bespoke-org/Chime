## ADDED Requirements

### Requirement: Creator can configure post-submission completion content
The system SHALL allow an authenticated creator to edit the completion content for an owned form, including a completion heading, supporting message, and an optional follow-up link label and URL.

#### Scenario: Creator saves custom completion text
- **WHEN** an authenticated creator updates the completion heading or supporting message for an owned form
- **THEN** the system saves the updated completion content as part of that form's settings

#### Scenario: Creator saves a follow-up link
- **WHEN** an authenticated creator provides both a follow-up link label and URL for an owned form
- **THEN** the system saves the follow-up link so it can be shown after submission

#### Scenario: Creator leaves follow-up link incomplete
- **WHEN** an authenticated creator leaves the follow-up link label or URL empty
- **THEN** the system does not save or expose a partial follow-up link for the form
