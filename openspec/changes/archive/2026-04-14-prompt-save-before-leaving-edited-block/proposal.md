## Why

The form builder keeps block edits in a local draft until the creator explicitly saves them. Today, selecting another block or switching away from the editor silently drops those unsaved changes, which makes the builder feel unreliable and increases the risk of accidental data loss.

## What Changes

- Detect unsaved edits in the active block editor by comparing the local block draft against the last saved block state.
- Prompt the creator before actions that would leave the active block editor with unsaved changes.
- Let the creator save changes, discard changes, or cancel the navigation so they can stay on the current block.
- Preserve the existing explicit save flow for block edits instead of introducing background autosave.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: require the builder to warn before switching away from a block that has unsaved edits and provide save/discard/cancel resolution paths.

## Impact

- Affected UI: `components/form-builder.tsx`, `components/form-builder-panels.tsx`, and shared confirmation dialog patterns.
- Affected behavior: block selection changes, switching from a block to form settings, and other builder actions that replace the active block editor.
- No API or database schema changes are expected.
