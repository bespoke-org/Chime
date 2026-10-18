## 1. Persist webhook settings

- [x] 1.1 Add nullable `webhookUrl` and `webhookSecret` columns to `Form` with a migration
- [x] 1.2 Validate both fields in `formMetadataSchema`: trim, empty to `null`, length limits, and a public http(s) URL check
- [x] 1.3 Thread the fields through `BuilderForm` and `toBuilderForm`, leaving `toPublicForm` unchanged
- [x] 1.4 Add schema tests for empty values, trimming, length limits, and rejected private or malformed URLs

## 2. Builder settings UI

- [x] 2.1 Extend the settings draft and save flow with the webhook URL and secret
- [x] 2.2 Add a Webhook section to the settings panel with help text in `en` and `ru`

## 3. Delivery

- [x] 3.1 Add `isPublicWebhookUrl` with IPv4, IPv6, and hostname suffix checks and unit tests
- [x] 3.2 Add `buildWebhookPayload` that lists visited question answers in snapshot order, with tests
- [x] 3.3 Add `signWebhookPayload` (HMAC-SHA256 over `timestamp.body`) with a test against `node:crypto`
- [x] 3.4 Add `deliverWebhook` with headers, signature, timeout, one retry on network error or 5xx, no retry on 4xx, and failure logging, with fake-fetch tests
- [x] 3.5 Call the deliverer from `createAnonymousResponse` after the response is stored, without awaiting it, and make it swappable for tests
- [x] 3.6 Add tests with a mocked database proving the deliverer is called only when a URL is set and that storage does not depend on delivery

## 4. Documentation

- [x] 4.1 Describe the payload, headers, signature verification, timeout and retry behavior, and the private-network restriction in `docs/deployment.md`
