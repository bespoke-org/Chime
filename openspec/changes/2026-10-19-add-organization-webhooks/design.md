## Context

`FormWebhook` rows belong to a form (`formId`) and carry a URL, a secret, an enabled switch, a mode and a digest schedule. `createAnonymousResponse` sends `response.created` to the form's enabled `IMMEDIATE` webhooks; `runDueDigests` sends `responses.batch` for each due `DIGEST` webhook. Organizations have an owner (`OrganizationMembership.role = OWNER`) and members; `assertOrganizationOwner` in `lib/workspaces.ts` is the existing owner check.

## Goals / Non-Goals

**Goals:**
- One webhook configured once for all forms of an organization, present and future.
- An endpoint configured both on a form and on its organization gets each event once.
- Members can see which organization webhooks receive their form's responses.

**Non-Goals:**
- Opting a form out of an organization webhook.
- Filtering organization webhooks by form.
- New payload fields that name the organization.

## Decisions

### 1. One table, two optional owners
`FormWebhook.formId` becomes optional and `organizationId` is added with a cascade on organization delete. A `CHECK` constraint `FormWebhook_one_owner` requires exactly one of them.

**Why:** Both kinds share the schedule, the claim on `lastDigestAt`, the validators and the editor. A second table would duplicate all of it.

### 2. Owner-only management, read-only for members
`lib/form-webhooks.ts` routes form and organization webhooks through the same list, create, update and delete helpers, keyed by `{ formId }` or `{ organizationId }`. The organization variants call `assertOrganizationOwner` first, so a member gets `403` and a non-member `404`. The limit of 10 applies per owner. `listOrganizationsForUser` returns the webhooks only to the owner. The builder form carries `organizationWebhooks` without secrets.

### 3. Deduplication by normalized URL and mode
`normalizeWebhookUrl` parses the URL and keeps `scheme://host[:port]` (lowercased by the URL parser, default port dropped), the path without trailing `/`, and the query; the fragment is dropped because it is never sent. For `response.created`, organization webhooks whose normalized URL matches an enabled `IMMEDIATE` form webhook are left out. For digests, a form with an enabled `DIGEST` webhook to the same normalized URL is left out of the organization's batch. A disabled form webhook does not hold back the organization one.

**Why:** The form webhook is the more specific setting, so its secret and schedule win. Different modes are different events, so both are sent.

### 4. Organization digest: one period, one batch series per form
A due organization webhook claims its slot like a form webhook. The runner then loads the organization's forms, drops those deduplicated by decision 3, and for each form with responses in `(since, slot]` sends that form's parts with the webhook's period bounds. The first failed part stops the run for this webhook; the existing give-back or 24-hour skip applies to the whole period. The summary counts the webhook once: `sent` when at least one form had responses and all were delivered, `empty` when no form had responses.

**Alternatives considered:**
- A `lastDigestAt` per form and organization webhook: rejected; it needs a new table and a claim per pair, while a re-sent form part is easy for the receiver to recognise by `formId`, `periodStart` and `part`.

### 5. Shared webhook editor
`WebhooksSection`, `WebhookEditor` and the schedule summary move to `components/webhooks-section.tsx`. The builder keeps passing its own save and delete callbacks; `ManagedWebhooksSection` keeps its own list and calls the endpoints under a given base path, which the workspace settings use. `OrganizationWebhooksList` renders the read-only rows in form settings.

## Risks / Trade-offs

- [A failing form makes the receiver get earlier forms of the same period again] → Documented; parts are identified by `formId`, `periodStart` and `part`.
- [An organization with many forms makes one count query per form per due slot] → Accepted for the expected number of forms.

## Migration Plan

- `20261019151547_add_organization_webhooks` makes `formId` nullable, adds `organizationId` with its index and foreign key, and the `FormWebhook_one_owner` check. Existing rows keep their `formId`.
- Rollback: delete organization rows, drop the column and the check, make `formId` required.

## Open Questions

- None.
