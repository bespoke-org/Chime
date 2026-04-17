## Why

The public form runner currently requires too much pointer interaction for common question flows and has at least one keyboard bug: pressing Enter to continue can also toggle the selected option on choice questions. Improving keyboard-first behavior now will make submissions faster, more accessible, and more predictable for respondents.

## What Changes

- Add keyboard-first answering support in the public runner for choice-based questions so respondents can use number keys like `1`, `2`, `3`, and so on to select or toggle visible options.
- Show respondents that numbered choice questions support keyboard shortcuts instead of leaving the capability hidden, and keep those button hints visible on mobile layouts too.
- Automatically focus the primary text-like input on questions that accept typed answers so respondents can start typing immediately.
- Restrict Enter handling so Enter advances to the next question or submits only when appropriate, and does not also toggle a selected choice option.
- Keep existing validation, branching, submission, and non-keyboard interaction behavior intact.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `anonymous-form-runner`: extend respondent interaction requirements so published forms support clearer, more reliable keyboard-driven answering and navigation.

## Impact

- Affected code: public runner keyboard event handling, responsive question option rendering, input focus management, localized helper copy, and runner regression coverage.
- No API or database changes are expected.
- The change is limited to respondent-facing published form behavior.