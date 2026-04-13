## MODIFIED Requirements

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
