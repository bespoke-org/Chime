## Why

The settings redesign made creator surfaces feel calmer and more intentional, while the form builder still feels comparatively layered and visually heavy. The builder also becomes awkward on long forms because the left block list keeps extending the page while the right editing panel leaves large empty areas, making navigation and editing less efficient.

## What Changes

- Refine the form builder visual hierarchy to reduce stacked surfaces, nested cards, and other overly layered treatments.
- Bring the builder’s surface language closer to the newer settings UI so creator pages feel more consistent.
- Keep the builder’s master-detail structure while simplifying how sections, panels, and controls are visually separated.
- Make the left block list independently scrollable so large forms do not make the entire page excessively tall.
- Keep the right editing panel usable alongside long block lists without leaving most of the viewport empty during deep scrolling.
- Preserve existing builder capabilities for block editing, publishing, settings, and responses while improving layout behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: Update builder layout behavior and presentation so it stays editing-focused, visually lighter, and more usable for long forms.
- `minimal-ui-surfaces`: Extend the minimal-surface design approach to the builder so creator UI uses fewer layered containers and less decorative separation.

## Impact

- Affected areas: builder layout, builder panel composition, block list scrolling behavior, and shared creator surface styling.
- Likely code: `components/form-builder.tsx`, `components/form-builder-panels.tsx`, related UI components, and global surface tokens/styles.
- No expected database or API changes.
