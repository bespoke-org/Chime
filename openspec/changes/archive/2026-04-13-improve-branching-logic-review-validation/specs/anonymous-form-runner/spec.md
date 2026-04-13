## ADDED Requirements

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
