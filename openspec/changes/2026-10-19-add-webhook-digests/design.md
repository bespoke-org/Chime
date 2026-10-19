## Context

`FormWebhook` rows hold a URL and a secret and are replaced as a list on every settings save. `createAnonymousResponse` starts one background delivery per webhook. There is no scheduler in the app; the only periodic job is `scripts/cleanup-uploads.ts` run from cron.

## Goals / Non-Goals

**Goals:**
- A webhook can be switched off, and can receive responses in periodic batches instead of one by one.
- A batch item has the same shape as a single `response.created` body, so receivers share one parser.
- A missed period is never sent twice and never once per missed slot.

**Non-Goals:**
- Per-webhook time zones.
- A delivery log or manual re-send.
- Running the scheduler across several app instances.

## Decisions

### 1. Mode and schedule columns on `FormWebhook`
`enabled`, `mode` (`IMMEDIATE` | `DIGEST`), `digestInterval` (`HOURLY` | `DAILY` | `WEEKLY`), `digestTime` (`"HH:MM"`), `digestWeekday` (0 = Sunday) and `lastDigestAt`. `position` is dropped; the list is ordered by `createdAt`. `lastDigestAt` is the end of the last period that was delivered or found empty.

**Why:** The schedule is small and fixed; a separate table would only add a join. `lastDigestAt` is both the period boundary and the claim token for concurrent ticks.

### 2. One app-wide zone, Intl for the math
`DIGEST_TIMEZONE` names an IANA zone; `lib/digest-schedule.ts` converts wall clock to UTC with `Intl.DateTimeFormat.formatToParts` and a two-pass correction, which settles across a DST change.

**Why:** Per-webhook zones would need a zone picker and copy for it; the product runs for one organisation. No date library is added for one conversion.

### 3. Slots and the due rule
A schedule defines slots. The due slot is the latest slot at or before now that lies after `lastDigestAt` (or after `createdAt` when nothing was sent yet). Several missed slots collapse into one, so one batch covers the whole gap after downtime.

**Alternatives considered:**
- One batch per missed slot: rejected; it floods the receiver after downtime and the per-slot boundaries carry no information the receiver cannot derive from `submittedAt`.

### 4. Claim, send, revert
A tick claims the slot with `updateMany({ where: { id, lastDigestAt: previous }, data: { lastDigestAt: slot } })`; a concurrent tick finds no row to update and skips. An empty period keeps the claim and sends nothing. A failed send reverts the claim so the next tick retries the whole period, unless the period is already older than 24 hours; then the claim is kept and a warning logged.

**Why:** The conditional update is the only coordination needed for overlapping ticks of a single instance, and it costs one query.

### 5. `responses.batch` reuses `buildWebhookPayload`
Each batch item is built by the same function as `response.created` and trimmed to `responseId`, `submittedAt`, `answers`. A period with more than 200 responses is sent as several parts in one tick, `part` 1..`parts`, same period bounds, ordered by `submittedAt`. `lastDigestAt` is kept only when every part was delivered.

### 6. Scheduler in `instrumentation.ts` plus a cron script
`register()` starts a 60 s timer when `NEXT_RUNTIME === "nodejs"` and not during the production build; a module-level flag on `globalThis` stops a second registration and a `running` flag stops overlapping runs. `scripts/run-digests.ts` runs one tick for deployments without a long-lived process.

### 7. Webhooks are saved one at a time
`lib/form-webhooks.ts` lists, creates, updates and deletes a webhook after the workspace access check and returns the form's whole list, which the builder shows. A changed digest schedule sets `lastDigestAt` to now, so the next batch does not reach back over responses already sent one by one.

## Risks / Trade-offs

- [Two app instances would both send a batch] → Documented; the deployment is one instance.
- [A receiver down for more than a day loses the period] → Accepted and logged; the responses are still in the app.
- [The default zone is specific to one deployment] → Any deployment can set `DIGEST_TIMEZONE`.

## Migration Plan

- `20261019131323_add_webhook_digests` adds the enums and columns and drops `position`. Existing webhooks become enabled `IMMEDIATE` ones.
- Rollback: drop the new columns; nothing else depends on them.

## Open Questions

- None.
