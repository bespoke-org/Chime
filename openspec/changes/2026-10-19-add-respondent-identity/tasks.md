## 1. Block config

- [x] 1.1 Add `identity` and `identityKey` to `shortTextConfigSchema` with the key pattern
- [x] 1.2 Reject a duplicate identity key in `updateOwnedBlock`

## 2. Webhook

- [x] 2.1 Add `formUrl`, `responseUrl` and `identity` to `buildWebhookPayload`

## 3. Review pages

- [x] 3.1 Collect identity in `buildResponseListItems` and `buildResponseDetailData`
- [x] 3.2 Show identity values as the row heading and the response page title

## 4. Builder

- [x] 4.1 Add the identity checkbox and the folded webhook key to the short answer panel
- [x] 4.2 Treat a draft that fails the block schema as an unsaved change

## 5. Tests and copy

- [x] 5.1 Test the key schema, the webhook body, and identity on the review pages
- [x] 5.2 Add the new copy to `en.yml` and `ru.yml`
