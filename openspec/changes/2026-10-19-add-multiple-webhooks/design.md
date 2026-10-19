## Context

`Form.webhookUrl` and `Form.webhookSecret` travel through `formMetadataSchema`, `toBuilderForm`, the settings panel draft, and one `PATCH` request. `createAnonymousResponse` starts one background `deliverWebhook` call when a URL is set; the deliverer signs, times out, retries once, and never throws.

## Goals / Non-Goals

**Goals:**
- Several webhooks per form, each with its own secret.
- No extra space in the settings panel for the common case of zero or one webhook.

**Non-Goals:**
- Per-webhook event filters, an enable switch, or a delivery log.
- Editing a single webhook without saving the form settings.

## Decisions

### 1. A `FormWebhook` table instead of a JSON column
`FormWebhook` has `id`, `formId` with cascade delete, `url`, `secret`, `position`, and `createdAt`, indexed on `(formId, position)`. The migration copies every non-null `webhookUrl` with its secret into the table at position 0 and then drops the two columns.

**Why:** A row per webhook leaves room for a delivery log or a switch per webhook later, and the cascade removes webhooks with the form.

**Alternatives considered:**
- A `webhooks Json` column on `Form`: rejected because it would need its own shape validation on read and gives nothing to attach delivery records to.

### 2. The settings save replaces the list
`formMetadataSchema` takes `webhooks: [{ url, secret }]`, at most 10 entries. Each URL goes through `isPublicWebhookUrl`; a card with an empty URL is dropped instead of rejected; an empty secret becomes `null`. `updateOwnedFormMetadata` writes the list in the same `form.update` with a nested `deleteMany` and `create`, so positions follow the order in the panel.

**Why:** Webhooks are edited together with the rest of the settings and saved by the same button; replacing the list avoids diffing ids on the client.

### 3. One delivery per webhook
`createAnonymousResponse` loads the webhooks ordered by position, builds the payload once, and starts one background deliverer call per webhook. Each call keeps the existing timeout, retry, and logging.

**Why:** A slow or failing endpoint must not delay the respondent or the other endpoints.

### 4. Cards appear only when added
The panel shows the Webhooks heading with a `+` icon button, disabled at 10. Each added webhook is a card with URL and secret fields and a remove button; the field hints appear on the first card only.

**Why:** Most forms have no webhook or one, so the panel looks as before until a second webhook is created.

## Risks / Trade-offs

- [Replacing the list recreates rows on every settings save] → Accepted; webhook ids are not referenced anywhere yet.

## Migration Plan

- The migration creates `FormWebhook`, copies existing webhooks, and drops the old columns.
- Rollback: restore the columns from the first webhook of each form.

## Open Questions

- None.
