## Context

The builder keeps form-level data and saved blocks in `components/form-builder.tsx`, but block edits live in local draft state (`blockDraft`, `choiceOptionsDraft`, and `branchRulesDraft`) until the creator presses **Save block**. The current selection model immediately swaps the editor when the creator selects another block or opens form settings, so unsaved edits are replaced by the newly selected data with no warning.

This change is limited to the creator builder. It does not require API, persistence, or schema changes because the existing block save endpoint already supports the data that must be preserved.

## Goals / Non-Goals

**Goals:**
- Detect whether the active block editor has unsaved changes compared with the last saved block state.
- Intercept builder actions that would replace the active block editor.
- Offer clear resolution paths: save changes and continue, discard changes and continue, or cancel and stay on the current block.
- Reuse the existing explicit save flow so saved data still comes from the same block PATCH request.

**Non-Goals:**
- Introduce autosave for block edits.
- Warn on every page navigation or browser tab close.
- Add unsaved-change protection for form settings fields in this change.
- Change block validation, publishing, or storage behavior.

## Decisions

### 1. Compute dirty state from saved block data versus serialized editor draft
The builder will derive `hasUnsavedBlockChanges` from the currently selected saved block in `form.blocks` and the active editor draft state.

Rationale:
- `selectedBlock` already reflects the last saved server state.
- Comparing serialized values avoids false positives from ephemeral draft IDs used for choice options and branch rules.
- Dirty detection stays local to the builder and does not require extra server reads.

Alternatives considered:
- Maintain a manual dirty flag on every input change. Rejected because it is easier to desynchronize when selection resets or saved data is reloaded.
- Deep-compare raw draft objects including generated IDs. Rejected because choice and branch draft IDs are intentionally unstable.

### 2. Gate editor-exit actions through a single pending-navigation workflow
Actions that replace the active block editor will route through one helper that either executes immediately or opens an unsaved-changes dialog when `hasUnsavedBlockChanges` is true. The pending action will be stored as a callback or discriminated state object and executed only after the creator chooses save or discard.

Covered actions:
- selecting a different block
- switching from a block to form settings
- creating a new block when the UI would switch focus to that new block

Rationale:
- Centralizing the guard keeps selection behavior consistent.
- The same workflow can support more editor-exit actions later without duplicating prompt logic.

Alternatives considered:
- Add separate confirmation logic inside each click handler. Rejected because it spreads stateful behavior across the component and makes later maintenance harder.

### 3. Save-before-leave reuses the existing `saveBlock` request path
The dialog's primary action will call the same save logic used by the existing **Save block** button, then continue the pending navigation only after the save succeeds. If the save fails, the builder will keep the current editor open and surface the existing error toast.

Rationale:
- Preserves one server write path for block updates.
- Avoids divergent payload shapes or duplicated mutation logic.
- Matches creator expectations: “Save” in the dialog behaves exactly like “Save block”.

Alternatives considered:
- Perform a lighter-weight temporary save or local stash before navigating. Rejected because it adds a second persistence model and changes the product behavior beyond the request.

### 4. Use a three-action modal built on the existing dialog primitive
The existing `ConfirmDialog` already supports custom `actions`, so the builder can present **Cancel**, **Discard changes**, and **Save changes** without introducing a second modal framework. New i18n strings will be added for the dialog title, body copy, and action labels.

Rationale:
- Keeps the UI consistent with the existing deletion confirmation pattern.
- Minimizes implementation surface area.
- Supports the required third action without changing the component contract significantly.

Alternatives considered:
- Replace the dialog with inline warnings inside the editor panel. Rejected because the creator may already have initiated navigation, and the system needs an immediate blocking choice.

## Risks / Trade-offs

- Dirty detection misses a field or compares the wrong normalized value → Add a dedicated helper for block-draft serialization and cover it with unit tests.
- Save-then-navigate can feel slow on poor connections → Reuse the existing pending state and disable repeated dialog actions while save is in flight.
- Pending navigation could run against stale selection state after async save → Store navigation intent explicitly and clear it only after execution or cancellation.
- Scope remains limited to block editors, so unsaved form settings can still be lost → Document that form settings protection is out of scope for this change.

## Migration Plan

- No data migration is required.
- Ship as a client-side builder update.
- Rollback is a normal code rollback because no persisted shape changes are involved.

## Open Questions

- None for proposal scope. The default behavior will be to guard only actions that leave the active block editor inside the builder experience.
