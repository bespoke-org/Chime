## 1. Dirty-state detection

- [x] 1.1 Add a builder helper that normalizes the active block draft, choice option drafts, and branch rule drafts into the same shape as the saved block.
- [x] 1.2 Derive `hasUnsavedBlockChanges` in `components/form-builder.tsx` by comparing the normalized active draft against the currently selected saved block.
- [x] 1.3 Add unit coverage for the normalization and dirty-state comparison logic, including choice and branching edits.

## 2. Guard editor-exit actions

- [x] 2.1 Add pending-navigation state in `components/form-builder.tsx` so block-selection changes, form-settings selection, and new-block creation can be intercepted consistently.
- [x] 2.2 Add an unsaved-changes dialog with cancel, discard, and save actions using the existing dialog primitive and builder-specific copy.
- [x] 2.3 Update the save flow so the dialog's save action reuses the existing block save request and continues navigation only after a successful save.
- [x] 2.4 Update discard and cancel handling so discard proceeds with navigation without saving and cancel keeps the current block draft intact.

## 3. UX polish and verification

- [x] 3.1 Add any required translation strings for the unsaved-changes dialog and button labels.
- [x] 3.2 Add component or interaction coverage for switching blocks and opening form settings with and without unsaved edits.
- [x] 3.3 Manually verify the builder flows for save, discard, cancel, and save-failure behavior before closing the change.
