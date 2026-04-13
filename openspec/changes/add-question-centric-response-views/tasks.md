## 1. Response review data shaping

- [x] 1.1 Add server-side response review helpers that aggregate question-level summaries from stored answers and visited-block snapshots
- [x] 1.2 Extend the responses page data payload to return both submission-centric data and question-centric summary data for answerable blocks
- [x] 1.3 Cover branching-aware aggregation cases such as reached, answered, skipped-by-branching, and empty-answer states

## 2. Responses page UI

- [x] 2.1 Add a view switcher on the responses page for submission-centric and question-centric review modes
- [x] 2.2 Keep the existing submission list behavior intact as the default mode
- [x] 2.3 Implement the question-centric list UI in form order with type-specific summary rendering for choice, numeric, and freeform blocks

## 3. Copy, metadata, and validation

- [x] 3.1 Add localized labels and empty states for the new response review mode and per-question summaries
- [x] 3.2 Update responses-page metadata and supporting presentation details to reflect the new review experience
- [x] 3.3 Verify the new view against forms with no responses, optional questions, and branched routes
