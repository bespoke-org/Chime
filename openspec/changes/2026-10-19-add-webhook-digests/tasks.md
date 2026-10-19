## 1. Schema and schedule

- [x] 1.1 Add `WebhookMode`, `DigestInterval`, the schedule columns and `lastDigestAt` to `FormWebhook`; drop `position`
- [x] 1.2 Write `lib/digest-schedule.ts` (`getDigestTimezone`, `getDigestSchedule`, `nextDigestSlot`, `latestDigestSlot`, `dueDigestSlot`) with Intl zone math and tests

## 2. Service and API

- [x] 2.1 `webhookInputSchema` with the per-mode requirements
- [x] 2.2 `lib/form-webhooks.ts` list/create/update/delete with the access check and the 10 limit
- [x] 2.3 `GET`/`POST /api/forms/:formId/webhooks` and `PATCH`/`DELETE /api/forms/:formId/webhooks/:webhookId`
- [x] 2.4 Remove `webhooks` from `formMetadataSchema` and `updateOwnedFormMetadata`

## 3. Delivery

- [x] 3.1 Deliver `response.created` only to enabled `IMMEDIATE` webhooks
- [x] 3.2 `lib/webhook-digests.ts`: `buildBatchPayload`, `runDueDigests` with claim, parts, revert and the 24 h cap
- [x] 3.3 `instrumentation.ts` timer and `bun run webhooks:digest`

## 4. Builder

- [x] 4.1 Webhook rows with mode badge, schedule summary, enabled switch, edit and delete
- [x] 4.2 Inline editor with URL, secret, mode, interval, weekday and time with the zone hint, saved through the endpoints
- [x] 4.3 Copy in `en.yml` and `ru.yml`

## 5. Docs and tests

- [x] 5.1 `docs/deployment.md` Webhooks section and `.env.example`
- [x] 5.2 Tests: schedule math, validators, service, digest runner, immediate delivery filter, builder editor
