## ADDED Requirements

### Requirement: Creator can configure operator-based branch conditions on question blocks
The system SHALL allow an authenticated creator to configure branch rules on answerable blocks using operator-aware conditions appropriate to the source block type. The supported operator set SHALL include `equals`, `not equals`, `is empty`, and `is not empty` for answerable blocks; `contains` for text-answer and link blocks; `contains any` for multiple choice blocks; and `greater than`, `greater than or equal`, `less than`, and `less than or equal` for number and date blocks.

#### Scenario: Creator configures a numeric threshold branch
- **WHEN** an authenticated creator configures a number question with a branch rule using a greater-than or less-than style operator
- **THEN** the system saves that operator and operand as part of the branch rule for that question

#### Scenario: Creator configures an empty-answer branch
- **WHEN** an authenticated creator configures a branch rule using `is empty` or `is not empty` on an answerable block
- **THEN** the system saves that rule without requiring a comparison value

#### Scenario: Creator configures a text contains branch
- **WHEN** an authenticated creator configures a text-answer or link question with a `contains` branch rule
- **THEN** the system saves the rule and limits it to a valid operator for that block type

### Requirement: Builder distinguishes branching blockers from advisory warnings
The system SHALL surface branching validation feedback while a creator edits a form and SHALL distinguish publish-blocking routing errors from non-blocking advisory warnings.

#### Scenario: Creator introduces a publish-blocking branching error
- **WHEN** an authenticated creator edits a branch rule so that its target is missing, invalid for that block type, or unreachable in the form graph
- **THEN** the system preserves the draft change, marks the issue as publish-blocking, and prevents publishing until it is fixed

#### Scenario: Creator introduces a fragile but still valid branch setup
- **WHEN** an authenticated creator creates a branch setup that is structurally valid but likely fragile or overlapping
- **THEN** the system surfaces an advisory warning without preventing the draft from being saved
