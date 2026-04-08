## MODIFIED Requirements

### Requirement: Form submission stores anonymous responses
The system SHALL allow a respondent to submit a completed published form anonymously, SHALL store only the form response data needed for review, without using creator login credentials as part of submission identity, and SHALL show a completion state based on the form's configured completion content.

#### Scenario: Respondent submits a completed form
- **WHEN** a respondent completes the final step of a published form and submits it
- **THEN** the system stores an anonymous response for that form and shows the form's completion state

#### Scenario: Form has custom completion content
- **WHEN** a respondent submits a published form whose creator configured custom completion text
- **THEN** the system shows the saved completion heading and message after submission

#### Scenario: Form has a configured follow-up link
- **WHEN** a respondent submits a published form whose creator configured a follow-up link label and URL
- **THEN** the system shows the follow-up link in the completion state after submission

#### Scenario: Form has no custom completion content
- **WHEN** a respondent submits a published form without customized completion settings
- **THEN** the system shows the default completion content after submission
