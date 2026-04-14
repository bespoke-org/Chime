## MODIFIED Requirements

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
