## Why

A workspace with many forms that report to the same server has to add the same webhook to every form, and to each new form again. When the URL or secret changes, every copy has to be edited.

## What Changes

- A `FormWebhook` belongs either to a form or to an organization. An organization webhook covers every form of the organization, including forms created later; there is no per-form opt-out.
- Only the organization owner manages organization webhooks, up to 10, in the workspace settings, through `GET`/`POST /api/organizations/:organizationId/webhooks` and `PATCH`/`DELETE /api/organizations/:organizationId/webhooks/:webhookId`.
- Form settings of an organization form list the organization webhooks read-only, marked as coming from the workspace, without their secrets.
- When an enabled form webhook and an organization webhook have the same normalized URL and the same mode, the form's event is sent once, through the form webhook.
- A digest organization webhook sends one `responses.batch` series per form with responses in the period; a failure on any form retries the whole period.
- Payload shapes do not change.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `response-webhooks`: webhooks owned by an organization, deduplication against form webhooks, and the organization digest.

## Impact

- Affected code: Prisma schema and migration, `lib/form-webhooks.ts`, `lib/forms.ts`, `lib/webhook-digests.ts`, `lib/organizations.ts`, the organization webhook API routes, `components/webhooks-section.tsx` (moved out of `components/form-builder-panels.tsx`), the workspace settings panel, localized copy, docs and tests.
- No new dependencies.
