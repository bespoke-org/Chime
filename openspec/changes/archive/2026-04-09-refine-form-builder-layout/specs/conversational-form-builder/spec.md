## MODIFIED Requirements

### Requirement: Builder exposes block editing through a master-detail layout
The system SHALL present a builder interface with an ordered block list for navigation and reordering and a separate editor panel for the selected block's settings. For long forms, the builder SHALL keep the navigation list usable without making the entire page grow unbounded from the block column alone.

#### Scenario: Creator selects a block
- **WHEN** an authenticated creator selects a block in the block list
- **THEN** the system displays that block's editable settings in the editor panel

#### Scenario: Creator works on a long form
- **WHEN** an authenticated creator opens a form with many blocks
- **THEN** the builder keeps the block list navigable without requiring the full page height to expand indefinitely with the left column

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
