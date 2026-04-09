## MODIFIED Requirements

### Requirement: Creator can export owned form responses in CSV and XLSX formats
The system SHALL allow an authenticated creator to export responses in CSV and XLSX formats for personal forms they own and organization forms belonging to organizations where they are members.

#### Scenario: Creator exports personal form responses as CSV
- **WHEN** an authenticated creator requests a CSV export for a personal form they own
- **THEN** the system downloads a CSV file containing that form's responses

#### Scenario: Creator exports organization form responses as XLSX
- **WHEN** an authenticated creator requests an XLSX export for a form belonging to an organization where they are a member
- **THEN** the system downloads an XLSX file containing that form's responses

### Requirement: Export requests are restricted by form ownership
The system SHALL allow response exports only for forms in workspaces the authenticated creator can access and SHALL deny export access for forms outside those workspaces.

#### Scenario: Creator exports inaccessible form
- **WHEN** an authenticated creator requests an export for a form they do not own personally and that does not belong to an organization they are part of
- **THEN** the system denies access and does not return response data
