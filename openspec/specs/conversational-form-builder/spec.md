## ADDED Requirements

### Requirement: Creator can create and manage form metadata
The system SHALL allow an authenticated creator to create a form draft and edit its title and shareable identity needed for public publishing.

#### Scenario: Creator creates a new form
- **WHEN** an authenticated creator creates a form
- **THEN** the system creates a new draft form owned by that creator

#### Scenario: Creator updates form title
- **WHEN** an authenticated creator edits the title of an owned form
- **THEN** the system saves the updated title for that form

### Requirement: Creator can manage an ordered list of supported blocks
The system SHALL allow an authenticated creator to add, select, edit, reorder, and remove blocks in a form using only the supported v0 block types: text, short text, long text, single choice, and multiple choice.

#### Scenario: Creator adds a block
- **WHEN** an authenticated creator adds a supported block type to an owned form
- **THEN** the system appends the new block to the form with a stable block identifier

#### Scenario: Creator reorders blocks
- **WHEN** an authenticated creator changes the order of blocks in an owned form
- **THEN** the system saves the new block order for the form

#### Scenario: Creator removes a block
- **WHEN** an authenticated creator removes a block from an owned form
- **THEN** the system removes that block from the current form structure

### Requirement: Builder exposes block editing through a master-detail layout
The system SHALL present a builder interface with an ordered block list for navigation and reordering and a separate editor panel for the selected block's settings.

#### Scenario: Creator selects a block
- **WHEN** an authenticated creator selects a block in the block list
- **THEN** the system displays that block's editable settings in the editor panel

### Requirement: Question blocks support required state and type-specific configuration
The system SHALL allow question blocks to be marked as required and SHALL support type-specific configuration for placeholders and choice options. Text blocks SHALL NOT be answerable and SHALL NOT expose a required setting.

#### Scenario: Creator marks a short text question required
- **WHEN** an authenticated creator enables required state for a question block
- **THEN** the system saves that question block as required

#### Scenario: Creator edits single choice options
- **WHEN** an authenticated creator updates the options for a single choice or multiple choice block
- **THEN** the system saves the updated option list for that block

#### Scenario: Creator edits a text block
- **WHEN** an authenticated creator edits a text block
- **THEN** the system allows content updates without exposing answer validation settings

### Requirement: Creator can publish and unpublish forms
The system SHALL allow an authenticated creator to publish or unpublish an owned form and SHALL expose a public shareable route only for published forms.

#### Scenario: Creator publishes a form
- **WHEN** an authenticated creator publishes an owned form
- **THEN** the system marks the form as published and makes its public route available for respondents

#### Scenario: Creator unpublishes a form
- **WHEN** an authenticated creator unpublishes an owned form
- **THEN** the system marks the form as unavailable for new public submissions

### Requirement: Builder chrome stays focused on editing
The system SHALL present the creator builder with concise, editing-focused chrome that emphasizes form status, navigation, and editing actions. The builder SHALL avoid promotional hero copy or decorative overview treatments that compete with the editing workflow.

#### Scenario: Creator opens the builder
- **WHEN** an authenticated creator opens an owned form in the builder
- **THEN** the system shows the form title, current status, and core actions needed to edit, publish, copy the link, or review responses without marketing-style framing

#### Scenario: Creator reads helper copy in the builder
- **WHEN** an authenticated creator views builder headings, descriptions, or empty states
- **THEN** the system uses short task-oriented copy that explains the current editing context without persuasive or ornamental language
