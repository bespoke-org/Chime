## Why

The public form runner currently always lets respondents move backward through their visited path. That works for editable interview-style flows, but some forms need creators to lock answers once a respondent advances so later questions cannot be influenced by revisiting earlier steps.

## What Changes

- Add a per-form setting that lets creators choose whether respondents can navigate backward in the public form runner.
- Preserve the current behavior as the default so existing forms continue allowing back navigation.
- Update the public runner to hide or disable backward navigation when the setting is off while keeping forward progress, validation, branching, and submission intact.
- Ensure saved draft progress and resumed sessions honor the form's configured back-navigation mode.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: add a form-level setting for whether respondents may go back to earlier steps in the public runner.
- `anonymous-form-runner`: allow forms to disable respondent back navigation and enforce that behavior consistently during active and restored sessions.

## Impact

- Affected code: Prisma form model, form settings validation and serialization, creator builder settings UI, public form runner navigation logic, runner draft restore behavior, and related tests/spec coverage.
- No new external dependencies are expected.
- Existing forms should remain backward-compatible by defaulting to back navigation enabled.
