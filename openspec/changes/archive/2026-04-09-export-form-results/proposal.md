## Why

Creators can review responses inside Lively Forms today, but they cannot take that data into spreadsheets, reporting workflows, or external tools. Adding export support now unlocks a practical next step for real form usage and addresses a common expectation for form products.

## What Changes

- Add creator-facing export actions for form responses from the response review area.
- Support exporting responses in CSV and XLSX formats for owned forms.
- Export one row per submission with stable columns derived from the form structure.
- Include submission metadata such as submission number and submitted timestamp in the export output.
- Serialize multi-select answers into a readable cell value for spreadsheet use.
- Prevent exporting responses for forms the current creator does not own.

## Capabilities

### New Capabilities
- `response-export`: Allow creators to export owned form responses in spreadsheet-friendly formats.

### Modified Capabilities
- `response-review`: Extend response review so creators can trigger exports for owned forms from the responses surface.

## Impact

- Affected areas: response review pages, form/response data shaping, export route or server action, and download UI.
- Likely code: `app/(creator)/forms/[id]/responses/`, `lib/forms.ts`, shared response/domain types, and API/server export logic.
- Likely dependencies: XLSX generation library or equivalent workbook writer.
- Security: ownership checks must apply to every export request.
