## MODIFIED Requirements

### Requirement: Exported answers are spreadsheet-readable
The system SHALL serialize answers into readable cell values suitable for spreadsheet use across supported formats. A file upload answer SHALL be written as the absolute URL of the authenticated download route, `<base URL>/api/forms/<formId>/uploads/<uploadId>`, built from `NEXTAUTH_URL`.

#### Scenario: Submission contains a multiple choice answer
- **WHEN** a creator exports responses that include a multiple choice answer
- **THEN** the selected options are written as a readable delimited value in the exported cell

#### Scenario: Submission contains long text content
- **WHEN** a creator exports responses that include long text answers
- **THEN** the exported file preserves the answer content as text in the corresponding cell

#### Scenario: Submission contains a file answer
- **WHEN** a creator exports responses that include an attached file
- **THEN** the cell holds the download URL of that upload, and an empty cell when no file was attached
