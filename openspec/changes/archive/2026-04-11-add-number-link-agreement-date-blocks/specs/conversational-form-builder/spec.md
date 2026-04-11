## MODIFIED Requirements

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
