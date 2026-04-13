## Why

Creators can currently review submissions only as a response-by-response list. That works for inspecting individual respondents, but it makes it hard to answer question-level product questions such as which options are selected most often, how many respondents skipped an optional question, or what the overall distribution of answers looks like.

## What Changes

- Add a second responses view that organizes data by question instead of by submission.
- Keep the existing response list as one of the available views so creators can continue reviewing individual submissions.
- Show per-question answer summaries and lightweight stats that match the block type, such as choice counts, answer totals, and completion or empty-state counts where relevant.
- Let creators drill into the answers for a selected question from the question-centric view.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `response-review`: expand response review from submission-only inspection to include question-centric review and aggregate answer summaries.

## Impact

- Affected areas: responses page UI, response review data shaping, localized copy, and metadata for the responses experience.
- Likely code changes in `app/(creator)/forms/[id]/responses/page.tsx`, response review components, and `lib/forms.ts` aggregation helpers.
- No new external dependencies expected.
