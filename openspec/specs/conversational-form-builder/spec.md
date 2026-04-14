## ADDED Requirements

### Requirement: Creator can create and manage form metadata
The system SHALL allow an authenticated creator to create a form draft within their personal workspace or an organization workspace they belong to and edit the title and shareable identity for any form in an accessible workspace.

#### Scenario: Creator creates a new personal form
- **WHEN** an authenticated creator creates a form in their personal workspace
- **THEN** the system creates a new draft form in that creator's personal workspace

#### Scenario: Creator creates a new organization form
- **WHEN** an authenticated creator creates a form in an organization workspace they belong to
- **THEN** the system creates a new draft form in that organization workspace

#### Scenario: Creator updates an accessible form title
- **WHEN** an authenticated creator edits the title of a form in a workspace they can access
- **THEN** the system saves the updated title for that form

### Requirement: Creator can manage an ordered list of supported blocks
The system SHALL allow an authenticated creator to add, select, edit, reorder, and remove blocks in a form located in an accessible workspace using the supported block types: text, short text, long text, single choice, multiple choice, number, link, agreement, and date.

#### Scenario: Creator adds a block
- **WHEN** an authenticated creator adds a supported block type to a form in an accessible workspace
- **THEN** the system appends the new block to the form with a stable block identifier

#### Scenario: Creator reorders blocks
- **WHEN** an authenticated creator changes the order of blocks in a form in an accessible workspace
- **THEN** the system saves the new block order for the form

#### Scenario: Creator removes a block
- **WHEN** an authenticated creator removes a block from a form in an accessible workspace
- **THEN** the system removes that block from the current form structure

### Requirement: Builder exposes block editing through a master-detail layout
The system SHALL present a builder interface with an ordered block list for navigation and reordering and a separate editor panel for the selected block's settings. For long forms, the builder SHALL keep the navigation list usable without making the entire page grow unbounded from the block column alone. When an authenticated creator attempts to replace the active block editor with another block editor or the form settings panel while the current block has unsaved edits, the system SHALL prompt the creator to save changes, discard changes, or cancel the navigation.

#### Scenario: Creator selects a block with no unsaved edits
- **WHEN** an authenticated creator selects a block in the block list and the current block editor has no unsaved edits
- **THEN** the system displays that block's editable settings in the editor panel

#### Scenario: Creator saves changes while switching blocks
- **WHEN** an authenticated creator selects a different block while the current block editor has unsaved edits and chooses to save changes
- **THEN** the system saves the current block changes and opens the newly selected block in the editor panel

#### Scenario: Creator discards changes while switching blocks
- **WHEN** an authenticated creator selects a different block while the current block editor has unsaved edits and chooses to discard changes
- **THEN** the system leaves the saved block unchanged and opens the newly selected block in the editor panel

#### Scenario: Creator cancels block switching
- **WHEN** an authenticated creator selects a different block while the current block editor has unsaved edits and chooses to cancel
- **THEN** the system keeps the current block editor open with the unsaved edits intact

#### Scenario: Creator opens form settings with unsaved block edits
- **WHEN** an authenticated creator switches from a block editor to the form settings panel while the current block has unsaved edits
- **THEN** the system requires the creator to save changes, discard changes, or cancel before replacing the block editor panel

#### Scenario: Creator works on a long form
- **WHEN** an authenticated creator opens a form with many blocks
- **THEN** the builder keeps the block list navigable without requiring the full page height to expand indefinitely with the left column

### Requirement: Question blocks support required state and type-specific configuration
The system SHALL allow question blocks to be marked as required and SHALL support type-specific configuration for placeholders, choice options, optional regex validation for text-answer blocks, and numeric constraints for number blocks. Number, link, agreement, and date blocks SHALL be treated as answerable question blocks with validation appropriate to their kind. Text blocks SHALL NOT be answerable and SHALL NOT expose a required setting.

#### Scenario: Creator marks a short text question required
- **WHEN** an authenticated creator enables required state for a question block
- **THEN** the system saves that question block as required

#### Scenario: Creator edits single choice options
- **WHEN** an authenticated creator updates the options for a single choice or multiple choice block
- **THEN** the system saves the updated option list for that block

#### Scenario: Creator edits a text block
- **WHEN** an authenticated creator edits a text block
- **THEN** the system allows content updates without exposing answer validation settings

#### Scenario: Creator adds an agreement block
- **WHEN** an authenticated creator adds an agreement block
- **THEN** the system saves it as an answerable block that can be marked required

#### Scenario: Creator adds a date block
- **WHEN** an authenticated creator adds a date block
- **THEN** the system saves it as an answerable block that accepts date responses

#### Scenario: Creator configures numeric constraints on a number question
- **WHEN** an authenticated creator configures a number block to disallow floats or sets minimum and maximum values
- **THEN** the system saves those numeric validation settings as part of the block configuration

#### Scenario: Creator configures regex validation on a text question
- **WHEN** an authenticated creator enables custom regex validation for a text-answer block and provides a pattern
- **THEN** the system saves that validation pattern as part of the block configuration

### Requirement: Creator can publish and unpublish forms
The system SHALL allow an authenticated creator to publish or unpublish a form in an accessible workspace and SHALL expose a public shareable route only for published forms.

#### Scenario: Creator publishes a form
- **WHEN** an authenticated creator publishes a form in an accessible workspace
- **THEN** the system marks the form as published and makes its public route available for respondents

#### Scenario: Creator unpublishes a form
- **WHEN** an authenticated creator unpublishes a form in an accessible workspace
- **THEN** the system marks the form as unavailable for new public submissions

### Requirement: Builder chrome stays focused on editing
The system SHALL present the creator builder with concise, editing-focused chrome that emphasizes form status, navigation, and editing actions. The builder SHALL avoid promotional hero copy, decorative overview treatments, and overly layered surface nesting that compete with the editing workflow.

#### Scenario: Creator opens the builder
- **WHEN** an authenticated creator opens an owned form in the builder
- **THEN** the system shows the form title, current status, and core actions needed to edit, publish, copy the link, or review responses without marketing-style framing

#### Scenario: Creator reads helper copy in the builder
- **WHEN** an authenticated creator views builder headings, descriptions, or empty states
- **THEN** the system uses short task-oriented copy that explains the current editing context without persuasive or ornamental language

#### Scenario: Creator views builder surfaces
- **WHEN** an authenticated creator uses the builder
- **THEN** the system organizes the layout with restrained layering and clear section hierarchy rather than stacked decorative containers

### Requirement: Creator can configure post-submission completion content
The system SHALL allow an authenticated creator to edit the completion content for an owned form, including a completion heading, supporting message, and an optional follow-up link label and URL.

#### Scenario: Creator saves custom completion text
- **WHEN** an authenticated creator updates the completion heading or supporting message for an owned form
- **THEN** the system saves the updated completion content as part of that form's settings

#### Scenario: Creator saves a follow-up link
- **WHEN** an authenticated creator provides both a follow-up link label and URL for an owned form
- **THEN** the system saves the follow-up link so it can be shown after submission

#### Scenario: Creator leaves follow-up link incomplete
- **WHEN** an authenticated creator leaves the follow-up link label or URL empty
- **THEN** the system does not save or expose a partial follow-up link for the form

### Requirement: Builder reflects the active workspace context
The system SHALL show the active workspace context when a creator creates or edits a form so they can tell whether the form belongs to their personal workspace or an organization.

#### Scenario: Creator opens a form builder in an organization workspace
- **WHEN** an authenticated creator opens a form that belongs to an organization workspace
- **THEN** the system shows that organization context in the builder chrome

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
