## ADDED Requirements

### Requirement: Creator can switch between dashboard form views
The system SHALL allow an authenticated creator to switch the dashboard form list between a grid view and a table view.

#### Scenario: Creator opens the dashboard
- **WHEN** an authenticated creator opens the dashboard with existing forms
- **THEN** the system shows the forms in the default grid view and offers a control to switch to table view

#### Scenario: Creator switches to table view
- **WHEN** an authenticated creator selects the table view option on the dashboard
- **THEN** the system displays the same forms in a table layout

#### Scenario: Creator switches back to grid view
- **WHEN** an authenticated creator selects the grid view option on the dashboard after using table view
- **THEN** the system displays the forms in the grid layout again

### Requirement: Table view shows sortable form management columns
The system SHALL present table columns for form title, status, response count, and updated date, and SHALL allow the creator to sort the table by each of those columns.

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

### Requirement: Dashboard actions remain available in each view
The system SHALL keep core dashboard management actions available in both grid and table views.

#### Scenario: Creator opens a form from grid view
- **WHEN** an authenticated creator uses a dashboard action in grid view
- **THEN** the system allows direct navigation to the builder or responses for that form

#### Scenario: Creator opens a form from table view
- **WHEN** an authenticated creator uses a dashboard action in table view
- **THEN** the system allows direct navigation to the builder or responses for that form
