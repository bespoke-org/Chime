## Why

Creators currently get a fixed completion state after respondents submit a form. That makes it hard to guide people toward a next step such as visiting a resource, booking time, joining a waitlist, or reading follow-up information.

## What Changes

- Allow creators to configure the text shown after a successful form submission.
- Allow creators to optionally add a follow-up link in the submission completion state.
- Replace the current fixed completion copy in the public runner with the form-specific completion content.
- Keep a sensible default completion message for forms that have not been customized.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: creators can edit post-submission completion content for an owned form.
- `anonymous-form-runner`: respondents see the form's configured completion content and optional follow-up link after submission.

## Impact

- Affected specs: `conversational-form-builder`, `anonymous-form-runner`
- Affected code: form metadata model, builder settings UI, public runner completion state, form serialization and persistence
- Affected APIs: form metadata update flow and any form payloads that expose completion content to the runner
