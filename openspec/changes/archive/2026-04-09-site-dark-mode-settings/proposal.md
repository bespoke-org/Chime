## Why

The product currently uses a single light theme, which can feel out of place for users whose devices are already set to dark mode. Adding site-wide theme support and a simple appearance setting will make the experience feel more native and give creators explicit control over light, dark, or system behavior.

## What Changes

- Add site-wide dark mode support across creator and public form surfaces.
- Detect the user’s OS color scheme and use it automatically when no explicit preference is selected.
- Add a creator Settings page linked next to Dashboard in the authenticated navigation.
- Add an appearance control with three options: Light, Dark, and System (default).
- Apply the selected theme consistently across the full site, including the home page, creator pages, and public form runner.

## Capabilities

### New Capabilities
- `site-theme-preferences`: site-wide theme support with system detection and a creator-accessible appearance setting for light, dark, or system mode.

### Modified Capabilities
- None.

## Impact

- Affected specs: `site-theme-preferences`
- Affected code: global layout, global styling variables, authenticated navigation, new settings page, theme preference persistence and hydration logic, public form and creator surfaces
- Affected APIs: none required if theme preference is stored client-side for now
