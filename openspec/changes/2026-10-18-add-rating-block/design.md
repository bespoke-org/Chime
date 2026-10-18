## Context

Question blocks are threaded through the system by their `FormBlockType` value: a zod config schema and localized defaults in `lib/blocks.ts`, answer validation in `lib/answer-validation.ts`, operand normalization and comparison in `lib/branching.ts`, question summaries in `lib/response-review.ts`, the builder settings panel, the branch rule editor and the public runner. The number block already covers numeric answers, integer-only validation, min/max limits, comparison operators and an average aggregate. A rating is a constrained number with a different respondent-facing control and a different review view, so the design reuses the number paths wherever they fit.

## Goals / Non-Goals

**Goals:**
- One block type that covers star-style ratings and NPS through its scale settings.
- Keyboard and pointer input in the runner consistent with choice questions.
- Numeric validation and branching identical in behavior to number blocks within the scale.
- Per-value distribution in review without a new summary kind.

**Non-Goals:**
- Star icons, emoji scales or half steps.
- A separate NPS block or NPS score computation.
- Changing how number blocks are configured, validated or reviewed.

## Decisions

### 1. A single `RATING` enum value with a small fixed config
Config is `{ min: 0 | 1, max: 2..10, minLabel, maxLabel, branchRules, defaultNextBlockId, endForm }` with defaults `1`, `5` and empty labels. Labels are trimmed and capped at 40 characters. Parsing fails when `max <= min`. `null` for `min` or `max` is treated as unset so stored configs without those fields get the defaults.

**Why:** Both ends and the step are fixed, so the runner can render every value as a button and the review can list every value. A 0 to 10 scale is NPS.

**Alternatives considered:**
- Reusing the number block with a `presentation` flag: rejected, number blocks allow floats, open ranges and placeholders that have no meaning for a scale.
- A separate NPS type: rejected, it is the same control with `min: 0, max: 10`.

### 2. Answers are number strings validated through the number path
The answer is stored as a string normalized by `normalizeNumericAnswer`, like a number answer. Validation reuses the existing error codes: `answer_required`, `invalid_number`, `whole_number_required`, `number_below_min`, `number_above_max`. The server-side submission message for a missing required rating says "choose a rating" instead of "enter a number".

**Why:** Review, export and branching already handle number strings. No new codes or storage shape are needed.

### 3. Branching treats rating like number
`isNumericAnswerBlock(type)` groups `NUMBER` and `RATING` for operand normalization, numeric comparison, default path analysis and condition validation. Supported and visible operators are the same as for number blocks. The branch rule editor uses a number input bounded by the scale.

### 4. Runner control is a button row with digit shortcuts
Buttons from `min` to `max` are marked as runner choice controls so Enter on a focused button advances the same way as for choices. Digit key `d` selects the value `d` when it is on the scale; `0` selects `10` when the scale reaches 10 (as the tenth choice option), otherwise `0` when the scale starts at 0. Clicking the selected value clears it. `minLabel` and `maxLabel` are shown under the row when set.

**Why:** For a 1 to 10 scale the index-based mapping of choice shortcuts and the value-based mapping agree; for a 0 to 10 scale the value-based mapping keeps `1` meaning 1.

### 5. Review extends the number summary with an optional distribution
`QuestionSummary` of kind `number` gets an optional `distribution` of `{ value, count }` for every value on the scale, including unused ones. Number blocks leave it undefined. The responses page renders the distribution under the min/average/max table when present.

**Why:** Average, min and max already exist for numbers; adding a field avoids a fourth summary kind and keeps the page branches small.

## Risks / Trade-offs

- [Creators change the scale after responses exist] → Stored answers stay as submitted; the distribution covers the current scale and the average still includes all numeric answers.
- [Shortcut mapping for 0 is not obvious] → `aria-keyshortcuts` is set on every button; the mapping follows the existing choice convention for 10.

## Migration Plan

- `ALTER TYPE "FormBlockType" ADD VALUE 'RATING'` through a Prisma migration. Rollback means removing the enum value, which Postgres does not support directly; forms would need their rating blocks deleted first.

## Open Questions

- None.
