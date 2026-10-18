## MODIFIED Requirements

### Requirement: Table view shows sortable form management columns
The system SHALL present table columns for form title, status, response count, and updated date, and SHALL allow the creator to sort the table by each of those columns. The status column and the grid card badge SHALL show `Closed` for a published form that is currently closed by its closing time, response limit, or manual switch, and `Published` otherwise.

#### Scenario: Creator views form data in table mode
- **WHEN** an authenticated creator opens the dashboard table view
- **THEN** the system shows each form with title, status, response count, and updated date columns

#### Scenario: Creator sorts by updated date
- **WHEN** an authenticated creator selects the updated date column in table view
- **THEN** the system reorders the visible forms by updated date

#### Scenario: Creator sorts by responses
- **WHEN** an authenticated creator selects the response count column in table view
- **THEN** the system reorders the visible forms by response count

#### Scenario: Creator sorts by title or status
- **WHEN** an authenticated creator selects the title or status column in table view
- **THEN** the system reorders the visible forms by the selected column

#### Scenario: Published form is closed
- **WHEN** an authenticated creator opens the dashboard and one published form has reached its response limit
- **THEN** the system shows `Closed` as that form's status in both the grid and the table view
