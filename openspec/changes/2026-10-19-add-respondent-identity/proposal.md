## Why

A webhook consumer receives answers by block id and title, and the responses page names each response only by its number. The creator cannot say which answers identify the respondent, such as a name or a Telegram handle, so the consumer has to guess them by title and the creator has to open every response to see who sent it. The webhook also carries no link to the form or the response.

## What Changes

- A "Short answer" block can be marked as identifying the respondent, with an optional webhook key of lowercase letters, digits and underscores; keys are unique among the form's identity fields.
- The webhook body gains `formUrl`, `responseUrl`, and `identity`, a list of `{ key, blockId, title, value }` for answered identity fields in form order.
- The responses list and the response page show identity values instead of the response number when the response has any; the response page keeps the number and date under the title.
- A builder draft that fails the block schema, such as a half-typed regex or key, counts as an unsaved change instead of breaking the page.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: creators mark short answer blocks as identity fields.
- `response-webhooks`: the body carries identity, form URL and response URL.
- `response-review`: responses are named by their identity values.

## Impact

- Affected code: `shortTextConfigSchema`, `updateOwnedBlock`, `buildWebhookPayload`, `response-review`, the responses list and response pages, the short answer panel, `hasBuilderBlockDraftChanges`, localized copy, and tests.
- No migration: the fields live in the block config JSON and default to off.
