## ADDED Requirements

### Requirement: Published forms are publicly accessible without respondent authentication
The system SHALL allow any respondent to open a published form's public route without signing in. Draft or unpublished forms SHALL NOT be available for public response collection.

#### Scenario: Respondent opens a published form
- **WHEN** a respondent navigates to the public route of a published form
- **THEN** the system displays the form runner without requiring authentication

#### Scenario: Respondent opens an unpublished form
- **WHEN** a respondent navigates to the public route of a draft or unpublished form
- **THEN** the system does not allow public response collection for that form

### Requirement: Runner presents blocks in a linear one-at-a-time flow
The system SHALL present form blocks in saved order and display exactly one block at a time with forward and backward navigation. Text blocks SHALL appear as part of the flow but SHALL NOT collect an answer.

#### Scenario: Respondent moves through the form
- **WHEN** a respondent advances through a published form
- **THEN** the system shows each block one at a time in the form's saved order

#### Scenario: Respondent returns to a previous block
- **WHEN** a respondent navigates backward in the runner
- **THEN** the system returns them to the previous block without breaking the saved in-progress answers for the session

### Requirement: Runner shows progress across the full flow
The system SHALL display progress for the respondent based on the linear block sequence, including non-answerable text blocks.

#### Scenario: Respondent views a text block in the flow
- **WHEN** a respondent is on a text block step
- **THEN** the system includes that step in the visible progress through the form

### Requirement: Required question blocks are validated before advancement
The system SHALL prevent a respondent from advancing past a required question block until a valid answer is provided for that block type.

#### Scenario: Respondent skips a required short text question
- **WHEN** a respondent attempts to continue from a required text question without an answer
- **THEN** the system blocks advancement and indicates that an answer is required

#### Scenario: Respondent skips a required multiple choice question
- **WHEN** a respondent attempts to continue from a required multiple choice block without selecting any options
- **THEN** the system blocks advancement and indicates that an answer is required

### Requirement: Form submission stores anonymous responses
The system SHALL allow a respondent to submit a completed published form anonymously and SHALL store only the form response data needed for review, without using creator login credentials as part of submission identity.

#### Scenario: Respondent submits a completed form
- **WHEN** a respondent completes the final step of a published form and submits it
- **THEN** the system stores an anonymous response for that form and shows a completion state
