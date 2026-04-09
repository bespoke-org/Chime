## 1. Theme foundation

- [x] 1.1 Add a shared theme preference model for `light`, `dark`, and `system`
- [x] 1.2 Add early theme initialization and browser persistence so the selected mode survives reloads and navigation
- [x] 1.3 Extend global theme tokens and shared surfaces to support both light and dark mode

## 2. Settings page and navigation

- [x] 2.1 Add Settings navigation next to Dashboard in the authenticated creator shell
- [x] 2.2 Create the authenticated Settings page
- [x] 2.3 Add an appearance control with Light, Dark, and System options and wire it to the shared theme preference

## 3. Site-wide adoption and verification

- [x] 3.1 Update creator and public pages that still rely on fixed light-only colors so they adapt correctly in dark mode
- [x] 3.2 Verify system mode follows OS preference while explicit Light and Dark overrides remain stable across navigation and reloads
- [x] 3.3 Run build and relevant checks to confirm site-wide theme switching works correctly
