## Context

A response is created in `createAnonymousResponse` after the submission is validated and the branch route replayed on the server. The form record and the snapshot of visited blocks are already in hand there, so that is the one place where a new response can be reported to an outside system. Form settings already carry respondent-facing options such as `respondentLocale` and `allowBackNavigation` through `formMetadataSchema`, `toBuilderForm`, and the settings panel, and the webhook settings follow that path. The app runs as a single Node process with no job queue.

## Goals / Non-Goals

**Goals:**
- Let a creator receive each stored response at a URL of their choice, with a signature they can verify.
- Keep storing the response and answering the respondent independent of the webhook endpoint's health.
- Stop the server from being used to reach private network addresses through a webhook URL.
- Keep payload building, signing, URL checking, and delivery testable without a network or database.

**Non-Goals:**
- A durable delivery queue, dead-letter storage, or a delivery log in the UI.
- Events other than a new response (edits, deletions, publication changes).
- Resolving DNS before delivery to catch hostnames that point at private addresses.
- Hiding the secret from the creator after it is saved; the builder already has full access to the form.

## Decisions

### 1. Two nullable columns on `Form`
`webhookUrl` and `webhookSecret` are stored as nullable strings on the form and travel through `formMetadataSchema`, `toBuilderForm`, and the settings panel like the other metadata fields. `toPublicForm` does not include them, so the public form payload never carries the secret or the URL.

**Why:** The webhook is form-level configuration, edited and saved together with the other settings. A separate table would add joins for one optional pair of values.

**Alternatives considered:**
- A `FormWebhook` table allowing several endpoints per form: rejected until there is a need for more than one.
- Storing the secret hashed: rejected because the server must use the plain secret to sign every request.

### 2. Payload is built from the submission snapshot
`buildWebhookPayload` walks the snapshot of visited blocks, keeps question blocks that have a stored answer, and emits `{ blockId, type, title, value }` with the normalized stored value. Skipped branches and text blocks are left out.

**Why:** The snapshot is already the record of what the respondent saw, in order. Reusing it keeps the webhook consistent with response review and exports.

**Alternatives considered:**
- Sending the raw `answersJson` map: rejected because the receiver would have to know block ids and lose the question titles and order.
- Serializing values to export strings (joined choices, localized agreement labels): rejected; a machine receiver is better served by the stored string or string array.

### 3. HMAC-SHA256 over timestamp and body
When a secret is set, the request carries `X-Lively-Forms-Timestamp` and `X-Lively-Forms-Signature: sha256=<hex>` where the hex is HMAC-SHA256 of `"<timestamp>.<body>"`. Without a secret the request is sent unsigned.

**Why:** This is the common shape of webhook signing; binding the timestamp lets receivers reject replays. The body is signed as the exact string that is sent.

**Alternatives considered:**
- Bearer token header: rejected because it does not bind the content and would be leaked by any log of request headers.
- Signing only the body: rejected because it allows replay without the receiver tracking ids.

### 4. Delivery runs after the write, in the background, and never throws
`deliverWebhook` posts with a 5-second `AbortController` timeout, retries once after 2 seconds on a network error, timeout, or 5xx, and does not retry a 4xx. Redirects are not followed. It returns `{ ok, status?, error? }` and logs failures with form id and status only. `createAnonymousResponse` calls it with `void` after `db.response.create` succeeds and returns the response without waiting.

**Why:** The respondent should not wait for or fail because of a third-party endpoint. A single retry covers brief outages without building a queue. Not following redirects stops a public URL from redirecting the server to a private address.

**Alternatives considered:**
- Awaiting delivery before answering the respondent: rejected; it ties response latency and errors to the endpoint.
- A background job table with a worker: rejected as infrastructure the single-process deployment does not need yet.

### 5. URL check by shape, in a pure function
`isPublicWebhookUrl` accepts only `http` and `https`, rejects embedded credentials, and rejects `localhost`, `*.localhost`, `*.local`, `*.internal`, loopback, private, link-local, and unspecified IPv4 and IPv6 literals including IPv4-mapped forms. `formMetadataSchema` uses it on save.

**Why:** A pure check on the written URL is cheap, testable, and blocks the obvious misuse. DNS-based checks would need resolution at save and at send time and still race with DNS changes.

### 6. Deliverer is swappable for tests
`lib/webhooks.ts` exposes `setWebhookDeliverer` and `getWebhookDeliverer`; `lib/forms.ts` resolves the deliverer at call time. Tests replace it with a recorder together with the mocked database.

**Why:** It keeps `createAnonymousResponse` free of fetch in tests without adding a parameter to a function that routes call with a fixed signature.

## Risks / Trade-offs

- [Delivery is lost if the process stops between the write and the send] → Accepted for now; the response itself is safe and a queue can be added later behind the same `deliverWebhook` interface.
- [A hostname can resolve to a private address despite passing the shape check] → Mitigation: documented limitation; redirects are not followed; the app runs behind a reverse proxy that does not expose internal services on public hostnames.
- [The secret is visible in the builder to anyone with form access] → Accepted; form access already grants the responses themselves.
- [Receivers that read a parsed and re-serialized body will not match the signature] → Mitigation: docs tell them to sign the raw body.

## Migration Plan

- Add two nullable `TEXT` columns to `Form` in one migration; no backfill.
- Rollback: drop the columns; code that reads them treats `null` as "no webhook".

## Open Questions

- None. Multiple endpoints per form and a delivery log can be revisited if creators ask for them.
