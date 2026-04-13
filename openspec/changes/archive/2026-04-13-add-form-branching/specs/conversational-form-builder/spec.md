## ADDED Requirements

### Requirement: Creator can configure answer-based branch rules on question blocks
The system SHALL allow an authenticated creator to add, edit, reorder, and remove branch rules on answerable blocks in a form located in an accessible workspace. Each branch rule SHALL compare the current block's answer using behavior appropriate to that block type and SHALL send respondents to a later block in the same form. The system SHALL also allow an authenticated creator to configure a default next target on an answerable block so respondents can continue to a chosen later block when no branch rule matches. If no branch rule matches and no default next target is configured, the respondent flow SHALL continue to the next block in saved order.

#### Scenario: Creator adds a conditional follow-up for one answer
- **WHEN** an authenticated creator configures a single choice question so one option branches to a later follow-up block
- **THEN** the system saves that branch rule on the source question and keeps the unconfigured path flowing to the next saved block

#### Scenario: Creator defines divergent paths from one question
- **WHEN** an authenticated creator configures different branch rules for different answers on the same question block
- **THEN** the system saves distinct later-block targets for those answers on that source block

#### Scenario: Creator changes branch priority
- **WHEN** an authenticated creator reorders branch rules on a question block
- **THEN** the system saves the updated evaluation order for that block's branch rules

### Requirement: Builder validates branch graphs before publishing
The system SHALL validate saved branch rules before allowing a form to publish. The system SHALL prevent publishing when a branch rule points to a missing, current, or earlier block, or when one or more blocks become unreachable from the first block under the configured branch graph.

#### Scenario: Creator tries to publish with a backward branch target
- **WHEN** an authenticated creator attempts to publish a form containing a branch rule that points to the source block or an earlier block
- **THEN** the system blocks publishing and indicates that the branch target must move forward in the form

#### Scenario: Creator tries to publish with an unreachable block
- **WHEN** an authenticated creator attempts to publish a form whose saved branch rules leave a block unreachable from the form start
- **THEN** the system blocks publishing and indicates that the unreachable block must be reconnected or removed

#### Scenario: Creator saves an invalid draft while editing branching
- **WHEN** an authenticated creator saves draft changes that leave branch validation issues unresolved
- **THEN** the system preserves the draft changes and continues to block publishing until the issues are fixed
