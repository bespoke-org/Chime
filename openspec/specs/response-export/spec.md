## ADDED Requirements

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

### Requirement: Export output uses one row per submission with stable columns
The system SHALL export one row per submission and SHALL include submission metadata plus one column for each answerable block in the form's saved order.

#### Scenario: Form contains multiple question types
- **WHEN** a creator exports responses for a form with multiple answerable block types
- **THEN** the export contains submission metadata columns followed by one column per answerable block in saved order

#### Scenario: Form contains text-only blocks
- **WHEN** a creator exports responses for a form that includes non-answerable text blocks
- **THEN** the export excludes those text blocks from answer columns

### Requirement: Exported answers are spreadsheet-readable
The system SHALL serialize answers into readable cell values suitable for spreadsheet use across supported formats.

#### Scenario: Submission contains a multiple choice answer
- **WHEN** a creator exports responses that include a multiple choice answer
- **THEN** the selected options are written as a readable delimited value in the exported cell

#### Scenario: Submission contains long text content
- **WHEN** a creator exports responses that include long text answers
- **THEN** the exported file preserves the answer content as text in the corresponding cell

### Requirement: Exports remain available when a form has no submissions
The system SHALL allow a creator to export an owned form even when it has no submissions and SHALL generate a file with headers only.

#### Scenario: Creator exports an owned form with no responses
- **WHEN** an authenticated creator exports a form they own that has no submissions
- **THEN** the system downloads a valid export file containing column headers and no submission rows
