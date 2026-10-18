## Why

Creators who run satisfaction surveys or NPS questionnaires have to use a number question with a minimum and a maximum. Respondents then type a number instead of picking a point on a scale, and the question-centric review shows only minimum, average and maximum, without the per-value distribution these surveys are read with.

## What Changes

- Add a rating question block with a fixed integer scale: lowest value 0 or 1, highest value between 2 and 10, and optional short labels for both ends. A 0 to 10 scale covers NPS; there is no separate NPS type.
- Render the scale in the public runner as a row of buttons with the end labels underneath. Digit keys select a value the same way they select choice options, and Enter advances.
- Validate the answer as a whole number inside the scale on the client and the server, and store it as a number string like a number answer.
- Allow the same branch operators as number blocks, with numeric comparison.
- Show the average, minimum, maximum and the count for every value on the scale in question-centric review. Export the raw number string.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: add the rating block type with its scale and label settings and number-style branching.
- `anonymous-form-runner`: render, validate and submit rating answers, including digit shortcuts.
- `response-review`: show a per-value distribution for rating blocks next to the numeric summary.

## Impact

- Affected code: Prisma `FormBlockType` enum and a migration, shared block config and answer validation, branching helpers, builder add-block menu and block settings panel, public runner, response review aggregates and page, localized copy, tests and specs.
- Existing data is unaffected; the migration only adds an enum value.
- No new dependencies.
