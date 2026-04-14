## Why

Refreshing a published form currently resets the public runner back to the start and discards any answers the respondent has already entered. Adding browser-local draft persistence now makes long or interruption-prone forms more forgiving without requiring respondent accounts or backend draft storage.

## What Changes

- Persist in-progress public form answers and visited runner position in browser local storage so respondents can recover from refreshes, tab closes, or accidental navigation away.
- Restore a saved in-progress draft when the same respondent reopens the same published form in the same browser and continue from the last valid visited step.
- Invalidate saved runner drafts when the published form structure no longer matches the saved draft, and clear the saved draft after successful submission.
- Surface lightweight runner feedback when progress is restored or discarded so respondents are not surprised by persisted state.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `anonymous-form-runner`: respondents can resume an in-progress published form from browser-local saved progress instead of losing answers on refresh.

## Impact

- `components/public-form-runner.tsx` runner state management, restoration flow, and submission cleanup
- Public form payload shaping and/or client-side draft fingerprinting used to detect stale saved progress
- Localized public runner copy for restore/discard feedback
- Browser storage behavior for anonymous respondent drafts with no server-side persistence changes
