## Context

The public runner already keeps answers and progress in client state and saves a draft in `localStorage` once `hasRunnerProgress` reports progress. Public endpoints live under `/api/public/forms/[slug]` and use the in-process `SlidingWindowRateLimiter` keyed by client IP. The dashboard list loads `_count.responses` in the same query as the forms, and the responses page receives the full response list.

## Goals / Non-Goals

**Goals:**
- Count unique browsers that opened a form and that started answering it.
- Keep the counting free of personal data and of the creator's own previews.
- Never slow down or break the runner because of tracking.

**Non-Goals:**
- Per-question drop-off, time-on-form, or traffic sources.
- Charts over time; the rows keep timestamps for that later.
- Exact counts across browsers or devices of the same person.

## Decisions

### 1. One `FormVisit` row per browser per form
`FormVisit` has `formId`, `visitorId`, `openedAt`, and a nullable `startedAt`, with a unique index on `(formId, visitorId)` that also serves lookups by form. Opened is the row count; started is the count of rows with `startedAt`.

**Why:** Repeated opens by one respondent should not inflate the funnel, and the unique index makes recording idempotent with an upsert. Rows instead of counters on `Form` keep the dates for a future chart.

**Alternatives considered:**
- `viewCount` and `startCount` columns on `Form`: rejected because every reload would count and the history would be lost.

### 2. A random visitor id in `localStorage`
The runner reads or creates a UUID under `chime:visitor-id`. When storage is unavailable, no event is sent.

**Why:** It holds no personal data and survives reloads. A hash of IP and user agent was rejected because it is personal data and merges people behind one NAT.

### 3. Events go through `navigator.sendBeacon`
`sendFormVisitEvent` posts `{ visitorId, event }` as a JSON blob with `sendBeacon`; without it the event is skipped. The runner sends `open` once on mount and `start` once when the draft logic first reports progress.

**Why:** A beacon does not block rendering, has no response to handle, and is delivered even when the respondent closes the tab right after answering.

### 4. The server ignores editors and unpublished forms
`recordFormVisit` validates the payload, returns without writing when the slug is not a published form, and skips the write when the request has a session whose user passes `workspaceAccessWhere` for the form. `start` upserts the row with `startedAt` and then sets `startedAt` where it is still null, so a start whose open beacon was lost still counts. The route applies a limit of 120 events per IP per 10 minutes and answers `204`.

**Why:** Unknown and unpublished slugs answer `204` like recorded ones, so the endpoint does not reveal which drafts exist.

### 5. Shares are capped and absent without visits
`getFunnelPercent(count, opened)` returns `null` when `opened` is 0 and otherwise the rounded share capped at 100. The page shows a dash for `null`.

**Why:** Responses collected before tracking began can outnumber visits, which would show shares above 100%.

## Risks / Trade-offs

- [Private windows, cleared storage, or several devices count as separate visitors] → Accepted; the funnel shows reach, not people.
- [A blocked beacon loses the event] → Accepted; submitted still comes from stored responses.
- [The in-process rate limiter is per Node process] → Same trade-off as the existing submission and upload limits.

## Migration Plan

- One migration creates `FormVisit` with a cascade delete on the form.
- Rollback: drop the table and remove the runner calls.

## Open Questions

- None.
