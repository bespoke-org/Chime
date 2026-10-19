## 1. Persist webhooks

- [x] 1.1 Add the `FormWebhook` model and a migration that copies existing webhooks and drops `webhookUrl` and `webhookSecret`
- [x] 1.2 Validate `webhooks` in `formMetadataSchema`: at most 10, public URLs, empty URL dropped, empty secret to `null`
- [x] 1.3 Replace the list in `updateOwnedFormMetadata` and return it through `toBuilderForm`

## 2. Delivery

- [x] 2.1 Load webhooks in `createAnonymousResponse` and start one background delivery per webhook with a shared payload

## 3. Settings panel

- [x] 3.1 Keep webhooks as a list in the metadata draft
- [x] 3.2 Add the `+` button, one card per webhook with a remove button, and hints on the first card

## 4. Tests and copy

- [x] 4.1 Test the schema limits and URL checks, delivery to every webhook, a failing webhook next to a working one, and the panel showing a card only after adding one
- [x] 4.2 Add the new copy to `en.yml` and `ru.yml`
