## ADDED Requirements

### Requirement: Builder provides a full-page branching graph workspace
The system SHALL allow an authenticated creator to open a graph-based branching workspace from the form builder. The graph workspace SHALL temporarily replace the standard sidebar-based builder layout and use the full available page width to visualize block-to-block routing.

#### Scenario: Creator opens graph mode from the builder toolbar
- **WHEN** an authenticated creator clicks the branching graph action beside the create-block action in the builder toolbar
- **THEN** the system opens the branching graph workspace for the current form

#### Scenario: Graph mode replaces the sidebar layout
- **WHEN** an authenticated creator opens the branching graph workspace
- **THEN** the system hides the normal block-list sidebar and standard editor panel while the graph workspace is active

#### Scenario: Creator exits graph mode
- **WHEN** an authenticated creator leaves the branching graph workspace
- **THEN** the system returns to the standard builder layout for the same form

### Requirement: Branching graph workspace visualizes routing from left to right
The system SHALL render each saved form block as a graph node and SHALL derive graph edges from the saved default-next target and saved branch-rule targets for each block. The graph SHALL lay blocks out from left to right in saved block order and SHALL keep linear forms readable even when no branching is configured.

#### Scenario: Creator views a linear form in graph mode
- **WHEN** an authenticated creator opens graph mode for a form with no branching rules or default-next overrides
- **THEN** the system displays the blocks as a left-to-right sequence of nodes

#### Scenario: Creator views a branched form in graph mode
- **WHEN** an authenticated creator opens graph mode for a form with saved branch rules or default-next targets
- **THEN** the system displays node connections that represent those possible next-block routes

#### Scenario: Graph nodes follow saved block order
- **WHEN** an authenticated creator views the branching graph workspace
- **THEN** the system positions nodes so the primary horizontal reading order follows the saved form block order from left to right

### Requirement: Creator can manage branching relationships from graph mode
The system SHALL allow an authenticated creator to inspect and update a block's branching relationships from the graph workspace using the same branching rule model and validation rules as the standard builder.

#### Scenario: Creator inspects a block's routing from graph mode
- **WHEN** an authenticated creator selects a block node in the branching graph workspace
- **THEN** the system shows that block's current default-next target and branch-rule relationships for editing

#### Scenario: Creator saves branching changes from graph mode
- **WHEN** an authenticated creator updates a block's branching relationships in graph mode and saves
- **THEN** the system persists those changes through the existing block branching save flow

#### Scenario: Graph mode preserves existing branching validation
- **WHEN** an authenticated creator saves branching changes from graph mode that would violate existing branching validation rules
- **THEN** the system rejects publishing or saving in the same way as the standard branching workflow requires
