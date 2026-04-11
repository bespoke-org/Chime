## MODIFIED Requirements

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

## ADDED Requirements

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
