## 1. Shared block model

- [x] 1.1 Add `RATING` to the Prisma `FormBlockType` enum and generate the migration
- [x] 1.2 Add the rating config schema, defaults, labels, translation keys and scale helpers to `lib/blocks.ts`
- [x] 1.3 Validate rating answers as whole numbers inside the scale and normalize them like number answers
- [x] 1.4 Treat rating blocks like number blocks in branching operand normalization, comparison and validation
- [x] 1.5 Add localized default block titles and the server-side missing-answer message

## 2. Builder

- [x] 2.1 Add the rating block to the add-block menu with an icon and localized title
- [x] 2.2 Add scale selects and end label inputs to the block settings panel
- [x] 2.3 Bound the branch rule operand input to the scale

## 3. Public runner

- [x] 3.1 Render the scale as a row of buttons with the end labels
- [x] 3.2 Select values with digit keys and advance with Enter
- [x] 3.3 Show a rating-specific message when a required rating is missing

## 4. Review and export

- [x] 4.1 Add a per-value distribution to the numeric summary for rating blocks
- [x] 4.2 Render the distribution on the question-centric responses page
- [x] 4.3 Confirm exports write the raw number string

## 5. Verification

- [x] 5.1 Add tests for config parsing, answer validation, branching, review aggregates, export, the runner control and the builder panel
- [x] 5.2 Add every new locale key to both languages and run the translation check
- [x] 5.3 Run lint, typecheck, format check, tests and build
