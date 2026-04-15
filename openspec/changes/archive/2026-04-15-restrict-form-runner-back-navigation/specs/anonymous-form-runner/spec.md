## MODIFIED Requirements

### Requirement: Runner presents blocks in a linear one-at-a-time flow
The system SHALL present form blocks one at a time starting from the first saved block and SHALL resolve each next block by evaluating the current block's saved branch rules against the respondent's current answer. If no branch rule matches, the system SHALL continue to the block's configured default next target when present, or otherwise continue to the next block in saved order. Text blocks SHALL remain part of the flow but SHALL NOT collect an answer. When the form allows respondent back navigation, the system SHALL allow backward navigation across the respondent's visited path and SHALL recalculate future visited steps when a prior answer changes. When the form disables respondent back navigation, the system SHALL keep the respondent moving forward only and SHALL NOT expose runner controls that return to earlier visited steps.

#### Scenario: Respondent sees a conditional follow-up question
- **WHEN** a respondent answers a question with a value that matches a saved branch rule pointing to a later follow-up block
- **THEN** the system shows that follow-up block as the next step in the runner

#### Scenario: Respondent skips a branch-only follow-up
- **WHEN** a respondent answers a question with a value that does not match any saved branch rule
- **THEN** the system continues to the next block in saved order instead of showing the branched follow-up block

#### Scenario: Respondent changes an earlier branching answer when back navigation is enabled
- **WHEN** a respondent navigates backward on a form that allows back navigation, changes an answer that controls branching, and continues again
- **THEN** the system recalculates the subsequent route from that changed answer and replaces the no-longer-valid future steps

#### Scenario: Respondent uses a form with back navigation disabled
- **WHEN** a respondent advances past a step on a form that disables back navigation
- **THEN** the system does not provide runner navigation that returns them to an earlier visited step

## ADDED Requirements

### Requirement: Restored public runner sessions honor the form's back-navigation mode
The system SHALL restore saved public-runner progress only when the saved route remains valid for the current form, and resumed interaction SHALL honor the form's currently configured back-navigation mode.

#### Scenario: Respondent resumes a form with back navigation disabled
- **WHEN** a respondent restores saved progress for a form whose current settings disable back navigation
- **THEN** the system restores the saved current step and answers without exposing runner navigation that goes back to earlier visited steps

#### Scenario: Respondent resumes a form with back navigation enabled
- **WHEN** a respondent restores saved progress for a form whose current settings allow back navigation
- **THEN** the system restores the saved current step and continues allowing backward navigation across the restored visited path
