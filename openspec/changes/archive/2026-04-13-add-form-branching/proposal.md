## Why

Lively Forms currently runs every published form as a fixed linear sequence, which makes simple follow-up questions and fully divergent form paths impossible. Adding branching now unlocks more practical onboarding, qualification, and decision-tree flows without forcing creators to duplicate forms for each audience.

## What Changes

- Add branching rules and configurable default next targets that let creators send respondents to different later blocks based on the current answer or a saved fallback path.
- Support both simple conditional follow-ups and jump-to-any-block branching across the form graph.
- Keep a safe default path so forms without custom branch rules still run in their saved order.
- Update the public runner to evaluate branch rules after each answer, navigate through the resulting path, and preserve back navigation across visited steps.
- Prevent creators from publishing forms with invalid branch targets or unreachable end states.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: creators can configure, review, and validate branch destinations between blocks instead of only editing a linear sequence.
- `anonymous-form-runner`: respondents move through a conditional block graph determined by prior answers rather than always following saved block order.

## Impact

- Builder UI for block editing, branch configuration, and publish-time validation
- Form block data model and API payloads for storing branching rules and targets
- Public form runner navigation, progress behavior, and backtracking state
- Submission validation and response snapshots so completed runs reflect the path actually taken
