## ADDED Requirements

### Requirement: Creator can list responses for owned forms
The system SHALL allow an authenticated creator to view submitted responses for forms they own and SHALL prevent them from listing responses for forms owned by others.

#### Scenario: Creator opens responses for an owned form
- **WHEN** an authenticated creator opens the responses view for a form they own
- **THEN** the system displays the submitted responses for that form

#### Scenario: Creator opens responses for another creator's form
- **WHEN** an authenticated creator opens the responses view for a form they do not own
- **THEN** the system denies access to that form's submitted responses

### Requirement: Creator can inspect a single response in form order
The system SHALL allow an authenticated creator to open an individual response and inspect answers mapped to the corresponding form blocks in the saved block order.

#### Scenario: Creator opens one response
- **WHEN** an authenticated creator selects a submitted response for a form they own
- **THEN** the system displays that response's answers in the order of the form's blocks

#### Scenario: Creator inspects response with text blocks in the form
- **WHEN** an authenticated creator views a response for a form that includes text blocks
- **THEN** the system shows only answerable block responses while preserving the form order context for the submission

### Requirement: Creator can start response exports from the responses view
The system SHALL present response export actions in the responses view for a form owned by the authenticated creator.

#### Scenario: Creator opens responses for an owned form
- **WHEN** an authenticated creator opens the responses view for a form they own
- **THEN** the system displays available export actions for the supported response export formats
