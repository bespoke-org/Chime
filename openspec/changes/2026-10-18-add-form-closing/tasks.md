## 1. Persist closing rules

- [x] 1.1 Add `closesAt`, `maxResponses`, `closedManually`, and `closedMessage` to `Form` with a migration
- [x] 1.2 Validate the fields in `formMetadataSchema`: empty strings to `null`, valid date, integer limit 1..1,000,000, trimmed message up to 1000 characters
- [x] 1.3 Thread the fields through `BuilderForm`, `toBuilderForm`, and `closedMessage` through `PublicForm`
- [x] 1.4 Add schema tests for defaults, empty values, invalid dates, rejected limits, and the message length

## 2. Availability helper

- [x] 2.1 Add `getFormAvailability` with the fixed reason order in `lib/form-availability.ts`
- [x] 2.2 Add tests for reason precedence, the inclusive deadline boundary, the cap boundary, and no cap

## 3. Public page and submission

- [x] 3.1 Return availability from `getPublicFormBySlug`, counting responses only when a cap is set
- [x] 3.2 Render `PublicFormClosed` with title and message for closed published forms; keep 404 for unpublished forms
- [x] 3.3 Re-check availability in `createAnonymousResponse` before the insert and throw `410` when closed
- [x] 3.4 Show the form's closed message, or the localized default, in the runner on `410`
- [x] 3.5 Add tests with a mocked database for manual, deadline, cap reached, under the cap, and open; runner tests for `410`; closed screen tests in `en` and `ru`

## 4. Builder and dashboard

- [x] 4.1 Add an Availability section to the settings panel with closing time, response limit, manual switch, and closed message
- [x] 4.2 Convert the `datetime-local` draft to ISO and the limit to a number on save
- [x] 4.3 Show a status line in the panel naming the rule that currently closes the form
- [x] 4.4 Add a `closed` flag to `FormStatusBadge`, pass it from the dashboard list and the builder header, with a badge test

## 5. Copy and documentation

- [x] 5.1 Add all new copy to `en.yml` and `ru.yml`
- [x] 5.2 Describe closing behavior, the `410` answer, and the cap race in `docs/deployment.md`
