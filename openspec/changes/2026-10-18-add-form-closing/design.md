## Context

A form is public when its `status` is `PUBLISHED`; `getPublicFormBySlug` and `createAnonymousResponse` both filter on that and answer 404 otherwise. Form-level settings travel through `formMetadataSchema`, `toBuilderForm`, the settings panel draft, and one `PATCH` request. The builder and the dashboard list already carry the response count of each form. The runner surfaces submission failures through `SubmitResponseError` with the HTTP status, and already maps `429` to a localized message.

## Goals / Non-Goals

**Goals:**
- Let a creator stop intake by time, by count, or by hand without unpublishing the form.
- Tell respondents the form is closed instead of showing a 404.
- Keep the decision in one pure function that the server, the builder, and tests share.

**Non-Goals:**
- Scheduling a form to open at a future time.
- A hard guarantee that the response limit is never exceeded.
- A new form status in the database or an audit of when a form closed.

## Decisions

### 1. Four columns on `Form`, availability derived
`closesAt DateTime?`, `maxResponses Int?`, `closedManually Boolean @default(false)`, and `closedMessage String @default("")` are added to `Form`. Whether a form is closed is computed by `getFormAvailability(form, responseCount, now)` in `lib/form-availability.ts`, which returns `{ open: true }` or `{ open: false, reason }` with `reason` one of `unpublished`, `manual`, `deadline`, `cap`, checked in that order. The deadline closes the form when `now >= closesAt`; the cap closes it when `responseCount >= maxResponses`.

**Why:** The rules are independent and a creator may set several at once. A derived value avoids a background job that flips a status column when the deadline passes or the count is reached, and it cannot drift from the data it is based on.

**Alternatives considered:**
- A `CLOSED` value in `FormStatus`: rejected because the deadline and the cap would need a scheduler or a write on every response to keep it current, and publish/unpublish logic would have to know about it.

### 2. The response count is fetched only when a cap is set
`resolveFormAvailability` in `lib/forms.ts` runs `db.response.count` only when `maxResponses` is not null, and passes `0` otherwise. The dashboard list reuses the `_count.responses` it already loads.

**Why:** Most forms have no cap, and the public page and every submission would otherwise pay for a count query.

### 3. Closed forms are checked at page load and right before insert
`getPublicFormBySlug` returns `{ form, availability }`; the page renders `PublicFormClosed` when the form is closed and still calls `notFound()` when the form is not published. `createAnonymousResponse` computes the availability after validating the answers and before `db.response.create`, and throws `AppError` with status `410` and the message `This form is no longer accepting responses.` when closed. The count and the insert are not wrapped in a transaction or a lock, so two submissions that both see `count < max` can both be stored and the form ends one over the limit.

**Why:** `410 Gone` describes a resource that existed and is no longer available, which lets the runner tell the case apart from `404` and `429`. The race is accepted: the cap protects against runaway intake, not against an exact seat count, and a lock or serializable transaction on every submission is not worth it for that.

**Alternatives considered:**
- `SELECT ... FOR UPDATE` on the form row around count and insert: rejected as unneeded contention for a soft limit.

### 4. The closed message falls back to a localized default in the UI
`closedMessage` is stored trimmed with `""` meaning "use the default". The default lives in `publicRunner.defaultClosedMessage` in the locale files and is resolved by `PublicFormClosed` and by the runner's `410` handler, so it follows the respondent locale rules like the rest of the runner. The builder shows the default as the textarea placeholder.

**Why:** Storing a default string would freeze it in one language, as happened with the legacy completion defaults.

### 5. Closing time is edited in local time
The settings panel uses `<input type="datetime-local">`. The draft holds the input's `YYYY-MM-DDTHH:mm` string; `toDateTimeLocalValue` renders the stored ISO instant in the creator's zone and `fromDateTimeLocalValue` converts the input back to an ISO string on save. `formMetadataSchema` accepts any string that parses to a valid date, including the past, so a creator can close a form immediately by picking an earlier time.

**Why:** No new dependency and no time zone picker; the creator's browser zone is the one they think in.

### 6. Status badge gets an optional `closed` flag
`FormStatusBadge` shows `Closed` when `status` is `PUBLISHED` and `closed` is true. The dashboard list item carries `closed`, computed on the server from `_count.responses`. The builder header and settings panel compute it on the client from the loaded `BuilderForm` and `responseCount`.

**Why:** The badge keeps one source of truth for the label while the data comes from the place that already has the count.

## Risks / Trade-offs

- [Cap can be exceeded by one under concurrent submissions] → Accepted; documented in `docs/deployment.md`.
- [Builder-side availability uses the browser clock] → The deadline shown in the panel can differ from the server by clock skew; the server decides what respondents see.
- [A form closed by the deadline reopens if the creator moves the time forward] → Intended; the settings are the single control.

## Migration Plan

- One migration adds the four columns with defaults; no backfill.
- Rollback: drop the columns; code treats missing rules as open.

## Open Questions

- None.
