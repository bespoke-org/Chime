## Why

Branching now supports forward routing and default next targets, but creators still lack the operator range, debugging visibility, and safety checks needed to build and maintain more complex flows confidently. Improving authoring, response review, and validation now will make branching trustworthy enough for production qualification and multi-path forms.

## What Changes

- Expand branching conditions with a practical v1 operator set: `equals`, `not equals`, `is empty`, `is not empty`, text `contains`, multiple-choice `contains any`, and number/date comparison operators.
- Show branching path context in creator response review so creators can see which route a respondent took and which blocks were skipped.
- Strengthen publish-time and builder-time branching validation with clearer issue detection for fragile, overlapping, or incomplete routing setups.
- Improve builder guidance so creators can understand how advanced operators and validation warnings affect route behavior before publishing.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: branching configuration gains richer operators, stronger validation feedback, and clearer authoring support.
- `anonymous-form-runner`: branching evaluation supports more operator types and preserves route context needed for review.
- `response-review`: creator response inspection exposes the visited branching path and skipped sections for each submission.

## Impact

- Branch rule data model, parsing, and validation logic in the form domain layer
- Builder UI for advanced condition editing and warning presentation
- Public runner route evaluation for richer operator support
- Response detail shaping and creator-facing review pages for path visibility
- Potential translation updates for new branching and review terminology
