## ADDED Requirements

### Requirement: Creator can inspect branching route context for a submission
The system SHALL allow an authenticated creator to inspect the visited route and skipped sections for an individual submission from a branched form while preserving the submission's saved form-order context.

#### Scenario: Creator opens a branched submission
- **WHEN** an authenticated creator views a response submitted through a branched form
- **THEN** the system shows which blocks were visited in the submission path and which blocks were skipped by branching

#### Scenario: Creator reviews a decision point in the visited path
- **WHEN** an authenticated creator inspects a visited branching question in a submission
- **THEN** the system shows the submitted answer in context so the taken route is understandable
