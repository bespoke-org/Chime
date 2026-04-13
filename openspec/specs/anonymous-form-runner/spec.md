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
The system SHALL present form blocks one at a time starting from the first saved block and SHALL resolve each next block by evaluating the current block's saved branch rules against the respondent's current answer. If no branch rule matches, the system SHALL continue to the block's configured default next target when present, or otherwise continue to the next block in saved order. Text blocks SHALL remain part of the flow but SHALL NOT collect an answer. The system SHALL allow backward navigation across the respondent's visited path and SHALL recalculate future visited steps when a prior answer changes.

#### Scenario: Respondent sees a conditional follow-up question
- **WHEN** a respondent answers a question with a value that matches a saved branch rule pointing to a later follow-up block
- **THEN** the system shows that follow-up block as the next step in the runner

#### Scenario: Respondent skips a branch-only follow-up
- **WHEN** a respondent answers a question with a value that does not match any saved branch rule
- **THEN** the system continues to the next block in saved order instead of showing the branched follow-up block

#### Scenario: Respondent changes an earlier branching answer
- **WHEN** a respondent navigates backward, changes an answer that controls branching, and continues again
- **THEN** the system recalculates the subsequent route from that changed answer and replaces the no-longer-valid future steps

### Requirement: Runner shows progress across the full flow
The system SHALL display progress based on the respondent's current visited route rather than assuming every saved block will appear, and SHALL update the visible step indicator when branching or backtracking changes that route.

#### Scenario: Respondent skips a section through branching
- **WHEN** a respondent takes a branch that skips one or more later blocks
- **THEN** the system updates the visible progress so it reflects the route the respondent is actually taking rather than the full saved block list

#### Scenario: Respondent changes the route by editing a previous answer
- **WHEN** a respondent goes back and changes an answer that changes the remaining route
- **THEN** the system updates the visible progress to match the recalculated route

### Requirement: Required question blocks are validated before advancement
The system SHALL prevent a respondent from advancing past a visited required question block until a valid answer is provided for that block type. For required agreement blocks, only an explicit agreed response SHALL satisfy the requirement. Question blocks skipped by branching SHALL NOT be required for advancement or submission.

#### Scenario: Respondent skips a required short text question
- **WHEN** a respondent attempts to continue from a visited required text question without an answer
- **THEN** the system blocks advancement and indicates that an answer is required

#### Scenario: Respondent skips a required multiple choice question
- **WHEN** a respondent attempts to continue from a visited required multiple choice block without selecting any options
- **THEN** the system blocks advancement and indicates that an answer is required

#### Scenario: Respondent does not agree to a required agreement block
- **WHEN** a respondent attempts to continue from a visited required agreement block without selecting agreed
- **THEN** the system blocks advancement and indicates that agreement is required

#### Scenario: Required block is skipped by a branch
- **WHEN** a respondent takes a branch that bypasses a required question block
- **THEN** the system does not require an answer for that skipped block before allowing completion or submission

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

### Requirement: Runner evaluates practical operator-based branching rules consistently
The system SHALL evaluate saved branching rules using the configured operator semantics for the active block before determining the next step in the respondent path. The runner and submission validation flow SHALL use the same operator behavior.

#### Scenario: Respondent triggers a numeric comparison rule
- **WHEN** a respondent answers a number or date question with a value that satisfies a saved comparison operator such as greater than or less than
- **THEN** the system routes the respondent to that rule's target block

#### Scenario: Respondent triggers an empty-answer rule
- **WHEN** a respondent leaves an optional question empty and the current block has a saved `is empty` branch rule
- **THEN** the system routes the respondent using that rule instead of treating the empty answer as unmatched

#### Scenario: Respondent triggers a multiple-choice contains-any rule
- **WHEN** a respondent selects multiple options and at least one selected option matches a saved `contains any` branch rule
- **THEN** the system routes the respondent to that rule's target block

#### Scenario: Client and server evaluate the same rule set
- **WHEN** a respondent completes and submits a branched form using supported advanced operators
- **THEN** the submission validation path accepts or rejects the route using the same branching semantics as the public runner
