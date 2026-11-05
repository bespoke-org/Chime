## Why

Every webhook fires once per response. Receivers that aggregate, such as a daily report to a chat channel or a nightly import, have to buffer requests themselves. Webhooks are also saved together with the form settings, so turning one off or changing its URL means saving the whole panel and there is no way to pause one.

## What Changes

- Each `FormWebhook` gets an on/off switch and a delivery mode: `IMMEDIATE` sends `response.created` per response as before; `DIGEST` sends `responses.batch` once per period, hourly, daily at a time or weekly on a weekday at a time, with every response stored in the period.
- Digest times are read in one app-wide zone, `DIGEST_TIMEZONE` (default `UTC`), shown in the builder next to the time field.
- A scheduler tick runs once a minute inside the server process and is also available as `bun run webhooks:digest` for cron. A missed slot after downtime is sent once for the whole gap; a failed batch is retried until the period is 24 hours old, then skipped and logged.
- Webhooks are managed through their own endpoints (`GET`/`POST /api/forms/:formId/webhooks`, `PATCH`/`DELETE /api/forms/:formId/webhooks/:webhookId`) and saved one at a time from the builder, no longer through the settings Save button; `formMetadataSchema` loses its `webhooks` field.
- **BREAKING**: `FormWebhook.position` is dropped; webhooks are listed by `createdAt`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `response-webhooks`: a second event, `responses.batch`, and the digest schedule rules.
- `conversational-form-builder`: webhooks are a list of rows with an inline editor, saved on their own.

## Impact

- Affected code: Prisma schema and migration, `lib/digest-schedule.ts`, `lib/webhook-validators.ts`, `lib/form-webhooks.ts`, `lib/webhook-digests.ts`, `instrumentation.ts`, `scripts/run-digests.ts`, the webhook API routes, `createAnonymousResponse`, `BuilderForm`, the settings panel, localized copy, docs and tests.
- No new dependencies; zone math uses the Intl API.
