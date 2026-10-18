## MODIFIED Requirements

### Requirement: Creator can inspect aggregate answers for a question
The system SHALL allow an authenticated creator to inspect a question-level summary for each answerable block using stored submissions that reached that block.

#### Scenario: Creator reviews a choice question
- **WHEN** an authenticated creator views a single-choice, multiple-choice, or agreement block in question-centric review
- **THEN** the system shows aggregate counts for the available answer options based on submissions that reached that block

#### Scenario: Creator reviews a numeric question
- **WHEN** an authenticated creator views a number block in question-centric review
- **THEN** the system shows aggregate numeric summary information derived from submitted answers for that block

#### Scenario: Creator reviews a rating question
- **WHEN** an authenticated creator views a rating block in question-centric review
- **THEN** the system shows the minimum, average and maximum of the submitted ratings together with the number of submissions for every value on the scale, including values nobody chose

#### Scenario: Creator reviews a freeform answer question
- **WHEN** an authenticated creator views a short text, long text, link, or date block in question-centric review
- **THEN** the system shows the submitted answers for that block together with summary counts for answered responses

#### Scenario: Creator reviews a branched question
- **WHEN** an authenticated creator views a question that is skipped for some submissions because of branching
- **THEN** the system distinguishes submissions that reached the block from submissions that skipped it by route

#### Scenario: Creator reviews a question with no submitted answers
- **WHEN** an authenticated creator views a question that has no answers yet
- **THEN** the system shows an empty summary state for that question instead of failing or hiding the block
