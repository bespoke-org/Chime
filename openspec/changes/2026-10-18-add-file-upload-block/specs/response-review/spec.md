## MODIFIED Requirements

### Requirement: Creator can inspect a single response in form order
The system SHALL allow an authenticated creator to open an individual response and inspect answers mapped to the corresponding form blocks in the saved block order. For a file upload block with an attached upload the system SHALL show the filename and size and a download link to `GET /api/forms/<formId>/uploads/<uploadId>`.

#### Scenario: Creator opens one response
- **WHEN** an authenticated creator selects a submitted response for a form they own
- **THEN** the system displays that response's answers in the order of the form's blocks

#### Scenario: Creator inspects response with text blocks in the form
- **WHEN** an authenticated creator views a response for a form that includes text blocks
- **THEN** the system shows only answerable block responses while preserving the form order context for the submission

#### Scenario: Creator inspects a response with a file answer
- **WHEN** an authenticated creator opens a response whose file upload block has an attached file
- **THEN** the system shows the filename, the size in megabytes and a download link for that upload

### Requirement: Creator can inspect aggregate answers for a question
The system SHALL allow an authenticated creator to inspect a question-level summary for each answerable block using stored submissions that reached that block.

#### Scenario: Creator reviews a choice question
- **WHEN** an authenticated creator views a single-choice, multiple-choice, or agreement block in question-centric review
- **THEN** the system shows aggregate counts for the available answer options based on submissions that reached that block

#### Scenario: Creator reviews a numeric question
- **WHEN** an authenticated creator views a number block in question-centric review
- **THEN** the system shows aggregate numeric summary information derived from submitted answers for that block

#### Scenario: Creator reviews a freeform answer question
- **WHEN** an authenticated creator views a short text, long text, link, or date block in question-centric review
- **THEN** the system shows the submitted answers for that block together with summary counts for answered responses

#### Scenario: Creator reviews a file upload question
- **WHEN** an authenticated creator views a file upload block in question-centric review
- **THEN** the system shows the count of responses with an attached file and a download link per response instead of the raw upload id

#### Scenario: Creator reviews a branched question
- **WHEN** an authenticated creator views a question that is skipped for some submissions because of branching
- **THEN** the system distinguishes submissions that reached the block from submissions that skipped it by route

#### Scenario: Creator reviews a question with no submitted answers
- **WHEN** an authenticated creator views a question that has no answers yet
- **THEN** the system shows an empty summary state for that question instead of failing or hiding the block
