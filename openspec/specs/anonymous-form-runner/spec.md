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
The system SHALL prevent a respondent from advancing past a required question block until a valid answer is provided for that block type. For required agreement blocks, only an explicit agreed response SHALL satisfy the requirement.

#### Scenario: Respondent skips a required short text question
- **WHEN** a respondent attempts to continue from a required text question without an answer
- **THEN** the system blocks advancement and indicates that an answer is required

#### Scenario: Respondent skips a required multiple choice question
- **WHEN** a respondent attempts to continue from a required multiple choice block without selecting any options
- **THEN** the system blocks advancement and indicates that an answer is required

#### Scenario: Respondent does not agree to a required agreement block
- **WHEN** a respondent attempts to continue from a required agreement block without selecting agreed
- **THEN** the system blocks advancement and indicates that agreement is required

### Requirement: Structured question answers are validated by block type
The system SHALL validate number, link, agreement, and date answers according to the active block kind before allowing a respondent to advance or submit the form. When a text-answer block is configured with custom regex validation, the system SHALL also validate the respondent's text answer against that regex pattern.

#### Scenario: Respondent enters an invalid number
- **WHEN** a respondent provides a non-numeric value for a number block
- **THEN** the system blocks advancement and indicates that a valid number is required

#### Scenario: Respondent enters a float when floats are disallowed
- **WHEN** a respondent provides a decimal value for a number block configured to allow only whole numbers
- **THEN** the system blocks advancement and indicates that a whole number is required

#### Scenario: Respondent enters a value outside the allowed numeric range
- **WHEN** a respondent provides a number below the configured minimum or above the configured maximum for a number block
- **THEN** the system blocks advancement and indicates that the answer is outside the allowed range

#### Scenario: Respondent enters an invalid link
- **WHEN** a respondent provides a malformed link value for a link block
- **THEN** the system blocks advancement and indicates that a valid link is required

#### Scenario: Respondent enters an invalid date
- **WHEN** a respondent provides an invalid or incomplete date value for a date block
- **THEN** the system blocks advancement and indicates that a valid date is required

#### Scenario: Respondent answers an optional agreement block
- **WHEN** a respondent selects agreed or not agreed for an optional agreement block
- **THEN** the system treats the explicit selection as the saved answer for that block

#### Scenario: Respondent enters text that does not match a configured regex
- **WHEN** a respondent provides a text answer for a text-answer block with custom regex validation and the answer does not match the saved pattern
- **THEN** the system blocks advancement and indicates that the answer format is invalid

### Requirement: Form submission preserves structured answers for supported block kinds
The system SHALL store submitted answers for supported number, link, agreement, and date blocks in the anonymous response data so creator-facing review flows can display them.

#### Scenario: Respondent submits a form with structured answers
- **WHEN** a respondent submits a published form containing number, link, agreement, or date blocks
- **THEN** the system stores those answers with the submission for later review

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
