## Why

Creators only see how many responses a form collected. They cannot tell whether a low count means few people opened the link or many opened it and gave up, which is the first thing they ask after sharing a form. Yandex Forms shows this as a funnel.

## What Changes

- Record a visit when a respondent opens a published form and mark it started on the first answer or step forward, one visit per browser per form.
- Identify the browser by a random id kept in `localStorage`; store no IP address, user agent, or other personal data.
- Skip visits by signed-in people who can edit the form, so previews by the author and workspace members are not counted.
- Show a funnel on the responses page: opened, started with its share of opened, and submitted with its share of opened.
- Show the opened count on dashboard grid cards next to the response count.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `anonymous-form-runner`: the runner reports open and start events for published forms.
- `response-review`: the responses page shows the opened, started, and submitted funnel.
- `dashboard-form-views`: grid cards show how many visitors opened each form.

## Impact

- Affected code: a `FormVisit` Prisma model and migration, `lib/form-visits.ts`, `lib/form-funnel.ts`, `lib/form-visit-tracking.ts`, a public `POST /api/public/forms/[slug]/visits` route, the public runner, the responses page, the dashboard list query and grid card, localized copy, and tests.
- No new dependencies.
- Forms published before this change start with zero visits; their existing responses still count as submitted.
