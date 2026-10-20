## Context

Block settings are stored in `FormBlock.config` and parsed per type by zod schemas in `lib/blocks.ts`. Responses keep a snapshot of the visited blocks with their config, so the webhook and the review pages can read the config a response was submitted with.

## Goals / Non-Goals

**Goals:**
- Let the consumer tell which answers identify the respondent, by key when the creator sets one.
- Name responses by who sent them on the responses page.

**Non-Goals:**
- A separate block type for a name or a handle.
- Identity on block types other than "Short answer".

## Decisions

### 1. Identity is a flag on the short answer config
`shortTextConfigSchema` gets `identity` (default `false`) and `identityKey` (default `null`). A key is trimmed, an empty key becomes `null`, and a key that does not match `^[a-z][a-z0-9_]{0,63}$` is rejected. `updateOwnedBlock` rejects with 409 a key already used by another identity field of the same form.

**Why:** "Short answer" already supports a regex, which covers handles and names; numbers and links do not identify a person.

### 2. Identity is a list in the webhook
`identity` holds `{ key, blockId, title, value }` for every identity field the respondent answered with a non-empty string, in form order, read from the response snapshot.

**Why:** A form can ask for a name and a handle at once, and the consumer needs to tell them apart. `blockId` stays for consumers that set no key.

### 3. Links in the webhook
`formUrl` is the public form URL and `responseUrl` is the response page, both built from the app base URL. The response page opens only for members of the form's workspace.

### 4. Identity in the review pages
`buildResponseListItems` and `buildResponseDetailData` collect identity from the current form blocks, so marking a field as identity also names responses sent before. A response with identity shows its values joined by ` · ` as the row heading and the page title; the response page shows "Response #N · date" under it.

### 5. The key stays folded
The panel shows the identity checkbox with a hint; the key input sits in a collapsed `<details>` that is open only when a key is set.

**Why:** Most creators need only the checkbox; the key is for integrators.

## Risks / Trade-offs

- [Identity values are free text typed by the respondent] → Accepted; they are shown as plain text and truncated in the list.

## Open Questions

- None.
