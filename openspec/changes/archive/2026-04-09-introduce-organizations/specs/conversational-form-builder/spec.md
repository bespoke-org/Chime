## MODIFIED Requirements

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
The system SHALL allow an authenticated creator to add, select, edit, reorder, and remove blocks in a form located in an accessible workspace using only the supported v0 block types: text, short text, long text, single choice, and multiple choice.

#### Scenario: Creator adds a block
- **WHEN** an authenticated creator adds a supported block type to a form in an accessible workspace
- **THEN** the system appends the new block to the form with a stable block identifier

#### Scenario: Creator reorders blocks
- **WHEN** an authenticated creator changes the order of blocks in a form in an accessible workspace
- **THEN** the system saves the new block order for the form

#### Scenario: Creator removes a block
- **WHEN** an authenticated creator removes a block from a form in an accessible workspace
- **THEN** the system removes that block from the current form structure

### Requirement: Creator can publish and unpublish forms
The system SHALL allow an authenticated creator to publish or unpublish a form in an accessible workspace and SHALL expose a public shareable route only for published forms.

#### Scenario: Creator publishes a form
- **WHEN** an authenticated creator publishes a form in an accessible workspace
- **THEN** the system marks the form as published and makes its public route available for respondents

#### Scenario: Creator unpublishes a form
- **WHEN** an authenticated creator unpublishes a form in an accessible workspace
- **THEN** the system marks the form as unavailable for new public submissions

## ADDED Requirements

### Requirement: Builder reflects the active workspace context
The system SHALL show the active workspace context when a creator creates or edits a form so they can tell whether the form belongs to their personal workspace or an organization.

#### Scenario: Creator opens a form builder in an organization workspace
- **WHEN** an authenticated creator opens a form that belongs to an organization workspace
- **THEN** the system shows that organization context in the builder chrome
