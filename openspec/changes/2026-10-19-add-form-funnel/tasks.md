## 1. Persist visits

- [x] 1.1 Add the `FormVisit` model with a unique `(formId, visitorId)` index and a migration
- [x] 1.2 Add `recordFormVisit` that validates the payload, ignores unpublished forms and editors, and upserts open and start
- [x] 1.3 Add `countFormVisits` for the opened and started counts of one form

## 2. Public endpoint and runner

- [x] 2.1 Add `POST /api/public/forms/[slug]/visits` with a per-IP rate limit, answering `204`
- [x] 2.2 Add `sendFormVisitEvent` with the `localStorage` visitor id and `sendBeacon`
- [x] 2.3 Send `open` on mount and `start` on the first progress from the runner

## 3. Display

- [x] 3.1 Add `getFunnelPercent` with the cap at 100 and no share without visits
- [x] 3.2 Show opened, started, and submitted on the responses page
- [x] 3.3 Load `_count.visits` in the dashboard list and show it on grid cards

## 4. Tests and copy

- [x] 4.1 Test idempotent opens, start without open, unpublished forms, editors, invalid ids and events, and percent edge cases
- [x] 4.2 Add the new copy to `en.yml` and `ru.yml`
