## ADDED Requirements

### Requirement: Creator can mark short answers as identity fields
The system SHALL allow an authenticated creator to mark a "Short answer" block as identifying the respondent and to give it an optional webhook key. A key SHALL start with a lowercase Latin letter, contain only lowercase Latin letters, digits and underscores, and be at most 64 characters; an empty key SHALL be stored as absent. Two identity fields of the same form SHALL NOT share a key. The key input SHALL stay folded until the creator opens it or a key is set.

#### Scenario: Creator marks a field without a key
- **WHEN** an authenticated creator checks "Identifies the respondent" on a short answer block and saves it
- **THEN** the system stores the block as an identity field with no key

#### Scenario: Creator sets an invalid key
- **WHEN** an authenticated creator saves an identity field with the key `Telegram-ID`
- **THEN** the system rejects the save with a validation error

#### Scenario: Creator reuses a key
- **WHEN** an authenticated creator saves an identity field with a key another identity field of the form already uses
- **THEN** the system rejects the save with a conflict error

#### Scenario: Creator types an incomplete value
- **WHEN** an authenticated creator types a value that does not pass validation yet into the regex or key field
- **THEN** the builder keeps working and marks the block as having unsaved changes
