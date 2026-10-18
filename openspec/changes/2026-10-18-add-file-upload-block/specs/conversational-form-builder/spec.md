## ADDED Requirements

### Requirement: Creator can add a file upload block
The system SHALL allow an authenticated creator to add a `FILE_UPLOAD` question block to any accessible form. The block config SHALL hold `accept` as one of `any`, `images` or `documents` (default `any`) and `maxSizeMb` as a whole number between 1 and 25 (default 10). A stored config with a missing, unknown or out-of-range value SHALL parse with the default for that field. The block SHALL support only the `is_empty` and `is_not_empty` branch operators.

#### Scenario: Creator adds a file upload block
- **WHEN** an authenticated creator adds a file upload block to a form
- **THEN** the system creates the block accepting any file up to 10 MB with no branch rules

#### Scenario: Creator restricts the block to images
- **WHEN** an authenticated creator sets the accepted files to images and the maximum size to 5 MB and saves the block
- **THEN** the system persists `accept: "images"` and `maxSizeMb: 5` and the public form carries both values

#### Scenario: Creator branches on whether a file was attached
- **WHEN** an authenticated creator opens the branch rule editor for a file upload block
- **THEN** the system offers only the "is empty" and "is not empty" operators and asks for no comparison value

#### Scenario: Stored config has an unknown accept value
- **WHEN** a file upload block's stored config names an accept value or a size outside the allowed set
- **THEN** the system treats that field as its default instead of failing to load the form
