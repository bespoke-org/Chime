## Why

The public submission endpoint accepts any request without limits. A published form can be flooded by a script or a crawler that fills every field, and the creator has no way to tell those responses from real ones. Before forms can be shared widely, submissions need a baseline defense that does not get in the way of real respondents.

## What Changes

- Limit how many submissions a client IP may send per form and across all forms within a sliding time window; excess requests receive a 429 and the runner shows a localized message.
- Add a hidden honeypot field to the public runner. Submissions that fill it are answered as if accepted but are not stored.
- Record when the respondent started the form and silently drop submissions that arrive faster than a minimum fill time.
- Make the limits configurable through environment variables with safe defaults, and document them for operators.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `anonymous-form-runner`: public submission is rate limited per client and form, and submissions that trip the honeypot or the minimum fill time are discarded without feedback to the sender.

## Impact

- Affected code: the public responses API route, the public form runner submit flow, new rate-limit and submission-guard modules, localized runner copy, environment documentation, and tests.
- No new dependencies. Limits are kept in process memory, which fits the single-instance deployment; a multi-instance deployment would need a shared store.
- Real respondents are unaffected unless they submit the same form more than the per-form limit within the window.
