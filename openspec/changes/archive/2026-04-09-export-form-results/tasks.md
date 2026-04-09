## 1. Export data shaping

- [x] 1.1 Add shared server-side helpers that load an owned form with its responses for export.
- [x] 1.2 Build a normalized export row shape with submission metadata and one column per answerable block in saved order.
- [x] 1.3 Implement answer serialization rules for short text, long text, single choice, and multiple choice responses.
- [x] 1.4 Add deterministic fallback column labels for untitled or duplicate questions.

## 2. File generation

- [x] 2.1 Add or configure the XLSX dependency needed for workbook generation.
- [x] 2.2 Implement CSV file generation using the normalized export dataset and proper escaping.
- [x] 2.3 Implement XLSX file generation using the same normalized export dataset.
- [x] 2.4 Add filename generation for exported files based on the form slug and selected format.

## 3. Creator export flow

- [x] 3.1 Add a server export endpoint or server action that validates form ownership before generating a download.
- [x] 3.2 Wire CSV and XLSX export actions into the creator responses view.
- [x] 3.3 Handle empty-response exports so creators can still download header-only files.
- [x] 3.4 Show loading and error states that fit the existing creator UI patterns.

## 4. Verification

- [x] 4.1 Verify owned-form exports succeed in both CSV and XLSX formats.
- [x] 4.2 Verify export requests for non-owned forms are denied.
- [x] 4.3 Verify exported column order and values match the saved form order and response content.
- [x] 4.4 Run the production build and fix any type or route issues introduced by the change.
