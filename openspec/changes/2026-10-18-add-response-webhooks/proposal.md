## Why

Responses stay inside the app until a creator opens the dashboard or downloads an export. Teams that want to react to a submission, for example to post it to a chat, add a row to a sheet, or start a process in their own system, have to poll or copy data by hand. A per-form webhook lets a creator receive each new response as soon as it is stored.

## What Changes

- Add a webhook URL and an optional signing secret to form settings, saved with the other form metadata.
- Send a signed `POST` with the form, response id, submission time, and answers to the URL after a response is stored.
- Sign the body with HMAC-SHA256 over the timestamp and the body when a secret is set, so the receiver can verify the sender.
- Reject webhook URLs that point at loopback, private, or link-local networks so the server cannot be pointed at itself or its neighbours.
- Keep response storage and the respondent's success answer independent of the webhook result; retry once on transient failures and log the rest.
- Document the payload, headers, signature check, and limits for operators.

## Capabilities

### New Capabilities
- `response-webhooks`: deliver stored responses to a creator-configured endpoint with a verifiable signature and bounded retries.

### Modified Capabilities
- `conversational-form-builder`: add webhook URL and signing secret to the form settings a creator can edit.

## Impact

- Affected code: Prisma form model and migration, form metadata validation, builder form serialization and types, form settings panel and draft/save flow, response creation in `lib/forms.ts`, a new `lib/webhooks.ts` module, localized builder copy, deployment docs, and tests.
- No new dependencies; signing uses `node:crypto` and delivery uses the global `fetch`.
- Existing forms are unaffected: both new columns are nullable and no request is sent until a URL is saved.
