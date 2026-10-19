## 1. Schema

- [x] 1.1 Optional `formId`, new `organizationId` with relation, index and `FormWebhook_one_owner` check

## 2. Service and API

- [x] 2.1 `normalizeWebhookUrl` and organization list/create/update/delete in `lib/form-webhooks.ts` with the owner check and the 10 limit
- [x] 2.2 `GET`/`POST /api/organizations/:organizationId/webhooks` and `PATCH`/`DELETE /api/organizations/:organizationId/webhooks/:webhookId`
- [x] 2.3 Organization webhooks in `listOrganizationsForUser` for the owner and in `BuilderForm.organizationWebhooks` without secrets

## 3. Delivery

- [x] 3.1 `response.created` to the organization's enabled immediate webhooks, minus those matching a form webhook URL
- [x] 3.2 `runDueDigests` for organization digest webhooks, one batch series per form, form-URL matches left out, retry of the whole period

## 4. UI

- [x] 4.1 Move the webhook list and editor to `components/webhooks-section.tsx`
- [x] 4.2 Webhooks in workspace settings for the owner
- [x] 4.3 Read-only organization webhooks in form settings
- [x] 4.4 Copy in `en.yml` and `ru.yml`

## 5. Docs and tests

- [x] 5.1 `docs/deployment.md` workspace webhooks
- [x] 5.2 Tests: owner check, limit, URL normalization, immediate dedupe, organization digest, digest dedupe, route auth, read-only list
