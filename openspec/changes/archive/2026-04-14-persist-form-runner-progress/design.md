## Context

The public runner currently keeps its respondent state entirely in React component memory inside `components/public-form-runner.tsx`. That state already includes the pieces needed to resume a session—`answers`, visited `history`, and `cursor`—but a refresh or closed tab recreates the component and drops all progress.

This change is intentionally scoped to anonymous public forms. There is no respondent account system, no server-side draft model, and no need to synchronize draft state across devices. The existing runner already has branch-aware navigation, client-side validation, and submission cleanup paths, so the main design problem is how to persist and safely restore the runner state without letting stale drafts corrupt a changed published form.

Key constraints:
- Persistence must remain optional and best-effort; the runner must still work when browser storage is unavailable.
- Restored progress must respect the current branching model and not trust corrupted route history blindly.
- The public form payload does not currently expose a dedicated published-version field for draft invalidation.
- The feature should not require database, API, or authentication changes for v1.

## Goals / Non-Goals

**Goals:**
- Preserve in-progress anonymous runner answers and visited position across refreshes and tab closes in the same browser.
- Restore only drafts that still match the current published form structure.
- Keep branching, validation, progress, and submission behavior consistent after restoration.
- Clear persisted draft data after successful submission.
- Provide lightweight respondent feedback when saved progress is restored or discarded.

**Non-Goals:**
- Cross-device or cross-browser draft sync.
- Server-side draft persistence or respondent identity.
- Multiple named drafts for the same form.
- A new creator-facing configuration switch for draft persistence.
- Full privacy hardening such as encryption-at-rest in the browser.

## Decisions

### 1. Use browser `localStorage` as the only persistence layer
Persist runner drafts locally in the browser under a form-scoped storage key. This keeps the feature aligned with the anonymous public runner: no login, no backend writes before submission, and no schema changes.

Draft persistence will be best-effort. All storage reads/writes will be wrapped in `try/catch`, matching the existing theme-preference pattern, so blocked storage or quota failures degrade gracefully to the current non-persistent behavior.

Why this approach:
- Matches the user's requested behavior for surviving refreshes.
- Avoids introducing draft APIs, abuse controls, or cleanup jobs.
- Keeps the implementation isolated to the public runner.

Alternatives considered:
- `sessionStorage`: survives refreshes but not closed tabs, which is weaker than the requested persistence.
- Server-side anonymous drafts: more durable, but adds backend complexity and draft identity problems that are out of scope.

### 2. Persist a validated draft payload instead of raw component state
Store a small JSON payload containing:
- `version`
- `formId` or equivalent form-scoped identity
- `fingerprint`
- `answers`
- `history`
- `cursor`
- `savedAt`

The restore path should validate this payload shape before using it. Invalid or partially corrupted JSON should be ignored and removed.

Why this approach:
- Keeps the payload explicit and migration-friendly.
- Avoids coupling storage directly to transient React implementation details.
- Makes it straightforward to add a future format bump if needed.

Alternatives considered:
- Store only `answers`: simpler, but loses the respondent's current step and weakens restoration for branched flows.
- Store the entire component state object: faster initially, but brittle if unrelated UI state changes.

### 3. Invalidate drafts using a deterministic form fingerprint derived from the public form payload
Because the public payload does not expose a published revision identifier, compute a deterministic fingerprint from the ordered serialized public blocks that drive routing and validation. The fingerprint should include enough structure to detect changes that could make a saved draft unsafe to reuse, such as block order, block IDs, block types, required flags, and block config.

On load, compare the stored fingerprint with the fingerprint computed from the current form. A mismatch means the draft is stale and must be discarded.

Why this approach:
- Prevents restoring answers onto a materially different published form.
- Avoids expanding the server payload just to support draft invalidation.
- Keeps all invalidation logic local to the runner.

Alternatives considered:
- Add `updatedAt` or a version field to `PublicForm`: workable, but introduces API/type changes for a feature that can be implemented client-side.
- Ignore form changes and always restore: unsafe for branching and validation changes.

### 4. Reconstruct restoration safety by replaying the saved route prefix
Do not trust stored `history` and `cursor` blindly. After reading a valid payload and matching fingerprint, replay the saved route prefix from the first block using the saved answers and the existing `resolveNextBlockId` helper. Restore only if the saved visited path remains valid for the current form and the saved cursor points at a block that is still reachable.

This means the restore flow should:
1. confirm the first saved block matches the form start
2. step through the saved visited prefix using current branching rules
3. stop and discard the draft if any next block does not match the replayed route
4. restore `answers`, `history`, and `cursor` only after validation succeeds

Why this approach:
- Keeps restored state aligned with the same routing logic used during live navigation.
- Protects against corrupted or manually edited local storage.
- Preserves the respondent's exact place in branched flows when the draft is valid.

Alternatives considered:
- Trust the stored route directly: simpler, but unsafe when branching rules or stored payloads drift.
- Recompute only from answers and ignore saved cursor: safer, but can move respondents away from the step they were actively on.

### 5. Persist with a short debounce after runner state changes
Save draft updates whenever `answers` or route state changes, but debounce writes slightly so long-text typing does not hammer synchronous `localStorage` writes on every keystroke. The persist effect should also skip writes until the initial restore attempt has completed, avoiding accidental overwrites during hydration.

Why this approach:
- Keeps the draft reasonably current without excessive write churn.
- Preserves refresh resilience even if a respondent has not clicked Continue yet.
- Minimizes the chance of writing a default empty draft before restore logic runs.

Alternatives considered:
- Write on every keystroke: simplest, but noisier and less efficient.
- Write only on Continue/Back: misses unsaved typing in the active step.

### 6. Clear drafts on successful submission and surface toast-level feedback
When submission succeeds, remove the stored draft before switching to the completion state. Also show lightweight localized feedback when a draft is restored successfully or when a stale/corrupted draft is discarded.

A toast-level message fits the existing runner UX and avoids blocking the respondent with extra prompts. The initial implementation does not add a separate “resume vs start over” decision dialog.

Why this approach:
- Prevents old answers from reappearing after a completed response.
- Reuses the runner's existing toast system and localization flow.
- Keeps the UX simple for the first release.

Alternatives considered:
- Silent restore/discard: lower UI overhead, but more surprising to respondents.
- Modal restore prompt: more explicit, but adds friction and extra state management.

## Risks / Trade-offs

- **Local browser storage can retain sensitive draft answers on shared devices** → Mitigation: scope drafts per form, clear on successful submission, and consider a manual discard control or TTL later.
- **Fingerprinting the full block structure may invalidate drafts after minor copy-only edits** → Mitigation: prefer safe invalidation over restoring against a changed form; losing a stale draft is better than resuming on the wrong route.
- **Storage may be unavailable in some browsers or privacy modes** → Mitigation: treat persistence as best-effort and fall back to current in-memory behavior without breaking the runner.
- **Replay validation may discard some drafts that could theoretically be partially recovered** → Mitigation: keep restoration strict in v1 so resumed sessions are predictable and branch-safe.

## Migration Plan

1. Add a small public-runner draft helper module for storage keys, payload parsing, fingerprinting, and remove/read/write helpers.
2. Integrate restore-on-mount logic into `components/public-form-runner.tsx` using the existing branch resolution utilities.
3. Add debounced persistence and successful-submission cleanup in the runner.
4. Add localized public-runner feedback strings for restored and discarded drafts.
5. Verify refresh, close/reopen, stale draft invalidation, branched-path restore, and post-submit cleanup behavior manually and/or with regression tests.

Rollback strategy:
- Stop reading and writing the draft helper from the public runner. Because the feature is browser-local only, no database or API rollback is needed.

## Open Questions

- Do we want a visible “Start over / clear saved progress” action in the runner after the basic restore flow ships?
- Should browser-local drafts expire automatically after a fixed age, such as 7 or 30 days?
