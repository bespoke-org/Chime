## ADDED Requirements

### Requirement: Creator can switch response review between submissions and questions
The system SHALL allow an authenticated creator to switch the responses page for an accessible form between a submission-centric list and a question-centric list while keeping submission review as the default mode.

#### Scenario: Creator opens responses for a form
- **WHEN** an authenticated creator opens the responses view for a form they can access
- **THEN** the system shows the submission-centric list by default and offers a control to switch to question-centric review

#### Scenario: Creator switches to question-centric review
- **WHEN** an authenticated creator selects the question-centric responses mode
- **THEN** the system shows answerable form blocks in form order instead of individual submissions

#### Scenario: Creator switches back to submission review
- **WHEN** an authenticated creator returns to the submission-centric responses mode after viewing question-centric review
- **THEN** the system shows the existing submission list again

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

#### Scenario: Creator reviews a branched question
- **WHEN** an authenticated creator views a question that is skipped for some submissions because of branching
- **THEN** the system distinguishes submissions that reached the block from submissions that skipped it by route

#### Scenario: Creator reviews a question with no submitted answers
- **WHEN** an authenticated creator views a question that has no answers yet
- **THEN** the system shows an empty summary state for that question instead of failing or hiding the block
