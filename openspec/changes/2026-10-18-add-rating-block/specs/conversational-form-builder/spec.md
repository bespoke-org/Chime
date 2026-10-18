## MODIFIED Requirements

### Requirement: Creator can manage an ordered list of supported blocks
The system SHALL allow an authenticated creator to add, select, edit, reorder, and remove blocks in a form located in an accessible workspace using the supported block types: text, short text, long text, single choice, multiple choice, number, link, agreement, date, and rating.

#### Scenario: Creator adds a block
- **WHEN** an authenticated creator adds a supported block type to a form in an accessible workspace
- **THEN** the system appends the new block to the form with a stable block identifier

#### Scenario: Creator reorders blocks
- **WHEN** an authenticated creator changes the order of blocks in a form in an accessible workspace
- **THEN** the system saves the new block order for the form

#### Scenario: Creator removes a block
- **WHEN** an authenticated creator removes a block from a form in an accessible workspace
- **THEN** the system removes that block from the current form structure

### Requirement: Creator can configure operator-based branch conditions on question blocks
The system SHALL allow an authenticated creator to configure branch rules on answerable blocks using operator-aware conditions appropriate to the source block type. The supported operator set SHALL include `equals`, `not equals`, `is empty`, and `is not empty` for answerable blocks; `contains` for text-answer and link blocks; `contains any` for multiple choice blocks; and `greater than`, `greater than or equal`, `less than`, and `less than or equal` for number, rating and date blocks.

#### Scenario: Creator configures a numeric threshold branch
- **WHEN** an authenticated creator configures a number question with a branch rule using a greater-than or less-than style operator
- **THEN** the system saves that operator and operand as part of the branch rule for that question

#### Scenario: Creator configures a rating threshold branch
- **WHEN** an authenticated creator configures a rating question with a branch rule using a greater-than or less-than style operator and a value on the scale
- **THEN** the system saves that operator and operand as part of the branch rule for that question

#### Scenario: Creator configures an empty-answer branch
- **WHEN** an authenticated creator configures a branch rule using `is empty` or `is not empty` on an answerable block
- **THEN** the system saves that rule without requiring a comparison value

#### Scenario: Creator configures a text contains branch
- **WHEN** an authenticated creator configures a text-answer or link question with a `contains` branch rule
- **THEN** the system saves the rule and limits it to a valid operator for that block type

## ADDED Requirements

### Requirement: Rating blocks collect a whole number on a fixed scale
The system SHALL support a rating question block whose scale starts at 0 or 1, ends at a whole number between 2 and 10, and optionally carries a short label of at most 40 characters for each end of the scale. The scale SHALL default to 1 through 5 with empty labels. The system SHALL reject a configuration whose highest value is not greater than its lowest value.

#### Scenario: Creator adds a rating block
- **WHEN** an authenticated creator adds a rating block
- **THEN** the system saves it as an answerable block with a 1 to 5 scale and empty end labels

#### Scenario: Creator configures an NPS scale
- **WHEN** an authenticated creator sets the lowest value to 0 and the highest value to 10 on a rating block
- **THEN** the system saves that scale as part of the block configuration

#### Scenario: Creator labels the ends of the scale
- **WHEN** an authenticated creator enters labels for the lowest and highest values of a rating block
- **THEN** the system saves the trimmed labels and rejects labels longer than 40 characters

#### Scenario: Creator saves an invalid scale
- **WHEN** a rating block configuration arrives with a highest value outside 2 through 10, a lowest value other than 0 or 1, or a highest value not greater than the lowest value
- **THEN** the system rejects the configuration
