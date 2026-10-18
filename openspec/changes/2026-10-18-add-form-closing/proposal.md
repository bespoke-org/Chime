## Why

Today a published form accepts responses until the creator unpublishes it, and an unpublished form answers with a 404. Creators who run a survey with a deadline, a sign-up with limited seats, or who want to pause intake have to watch the form and unpublish it by hand, and people who open the link afterwards see a not-found page with no explanation.

## What Changes

- Add three closing rules to form settings: a closing time, a response limit, and a manual switch, plus a closed message shown to respondents.
- Derive a form's availability from its status, the rules, the stored response count, and the current time; the Prisma `FormStatus` enum stays `DRAFT` and `PUBLISHED`.
- Render a closed screen with the form title and the closed message on the public page of a published but closed form; unpublished forms keep answering 404.
- Reject submissions to a closed form with `410` right before the response is stored, and show the closed message in the runner.
- Show a `Closed` status badge in the dashboard and the builder for published forms that are closed, and a status line in the settings panel naming the rule that closed the form.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: creators can configure closing rules and a closed message in form settings.
- `anonymous-form-runner`: closed published forms show a closed screen and refuse submissions with `410`.
- `dashboard-form-views`: the status display distinguishes published forms that are closed.

## Impact

- Affected code: Prisma form model and migration, form metadata validation, a new `lib/form-availability.ts` helper, builder and public form types and serialization, public form page and a new closed-screen component, response creation in `lib/forms.ts`, the runner's submission error handling, the form settings panel and draft/save flow, the status badge and dashboard list items, localized copy, deployment docs, and tests.
- No new dependencies; the closing time input is `<input type="datetime-local">`.
- Existing forms are unaffected: the new columns default to open.
