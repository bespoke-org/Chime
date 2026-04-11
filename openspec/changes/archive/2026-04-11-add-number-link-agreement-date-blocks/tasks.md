## 1. Shared block model and validation

- [x] 1.1 Extend shared block kinds, form types, and validators to include number, link, agreement, and date blocks, plus numeric constraints for number blocks and optional regex validation metadata for text-answer blocks.
- [x] 1.2 Update block create/update server flows to accept the new block kinds and persist their configuration safely, including float/min/max rules on number blocks and custom regex patterns on text-answer blocks.
- [x] 1.3 Normalize saved answer values for the new block types so downstream review/export code can consume them consistently.

## 2. Builder support

- [x] 2.1 Add the new block types to the builder add-block menu with localized labels and icons.
- [x] 2.2 Update block settings panels so number, link, agreement, and date blocks can be edited with the correct required-state and type-specific UI, including float/min/max controls for number blocks.
- [x] 2.3 Add builder controls for enabling and editing custom regex validation on text-answer blocks.
- [x] 2.4 Ensure builder block list rows, titles, and previews render the new block kinds clearly.

## 3. Public runner and submission flow

- [x] 3.1 Render number, link, agreement, and date inputs in the public runner using inputs appropriate to each block kind.
- [x] 3.2 Enforce client/server validation so respondents cannot advance with invalid number, link, date, or regex-constrained text answers, including integer-only and min/max number rules.
- [x] 3.3 Implement required agreement behavior so only an explicit agreed answer satisfies a required agreement block.
- [x] 3.4 Verify final submission stores structured answers for the new block types in anonymous responses and preserves regex-validated text answers normally.

## 4. Creator review and verification

- [x] 4.1 Update response review and export formatting so stored number, link, agreement, and date answers are readable to creators.
- [x] 4.2 Add or update localized strings needed for builder and runner copy for the new block types and regex validation UI.
- [x] 4.3 Run build and targeted manual verification covering create/edit/respond/review flows for each new block type and regex-validated text questions.
