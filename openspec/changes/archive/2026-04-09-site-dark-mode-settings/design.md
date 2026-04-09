## Context

The site currently uses one light visual theme across the home page, creator shell, dashboard, builder, response review, and public form runner. The requested change adds two related capabilities: automatic adaptation to OS theme preference and a creator-facing Settings page where the user can explicitly choose Light, Dark, or System.

This is a cross-cutting UI change because it affects shared tokens, top-level layout behavior, creator navigation, and both authenticated and public-facing pages. It also needs to avoid a visible flash of the wrong theme during initial page load.

## Goals / Non-Goals

**Goals:**
- Support both light and dark themes site-wide.
- Default to following the OS theme when no explicit preference is selected.
- Add a Settings page in creator navigation with a three-way appearance control: Light, Dark, System.
- Apply the selected preference consistently to creator pages, home page, and public forms.
- Minimize theme flicker during initial render.

**Non-Goals:**
- Syncing theme preference to the database or across all devices.
- Per-form or per-page custom theme palettes.
- Multiple settings sections beyond appearance.
- Rebuilding every component with a unique dark-mode design language; the first pass should adapt the current design system coherently.

## Decisions

### Store the explicit preference client-side and derive the active theme at runtime
Use a client-side persisted preference with values `light`, `dark`, or `system`, and compute the active theme from that setting plus `prefers-color-scheme`.

**Why this approach:**
- Matches the requested Light / Dark / System behavior.
- Avoids schema and account-model changes for an initial version.
- Lets the theme apply to public pages in the same browser without authentication.

**Alternatives considered:**
- Persist preference in the user record: stronger cross-device consistency, but adds backend and migration scope not required for the initial feature.
- Support only automatic OS detection with no settings page: does not satisfy the requirement for explicit user control.

### Apply theme through shared CSS variables at the document level
Use the existing tokenized color system in `app/globals.css` and switch token values through a top-level theme class or data attribute.

**Why this approach:**
- Most of the UI already references shared variables like `--bg`, `--ink`, and `--accent`.
- Allows broad theme coverage without rewriting each component individually.
- Keeps the visual language aligned between creator and public surfaces.

**Alternatives considered:**
- Add dark-mode utility classes component by component: harder to maintain and more error-prone for a site-wide theme.

### Set theme early during page boot to reduce flash
Add a lightweight early theme initialization path so the chosen preference is applied before the main UI paints.

**Why this approach:**
- Prevents a distracting flash from light to dark or dark to light.
- Important because the theme affects the entire shell and public runner.

**Alternatives considered:**
- Apply theme only after client hydration: simpler, but more likely to produce visible flicker.

### Add Settings as a creator page in the existing authenticated shell
The Settings page should live alongside Dashboard in the creator navigation and initially expose only the appearance control.

**Why this approach:**
- Matches the requested IA change.
- Keeps settings discoverable in the same shell used for creator management.
- Leaves room for future settings without changing navigation again.

**Alternatives considered:**
- Put appearance controls in the dashboard header: faster, but less scalable and less aligned with the explicit request for a Settings page.

## Risks / Trade-offs

- **Client-side persistence does not sync across devices** → Mitigation: acceptable for the first version; document this as a non-goal and revisit later if needed.
- **Some components may still use hard-coded light colors** → Mitigation: audit creator and public surfaces and move remaining values onto shared theme-aware tokens where needed.
- **Theme flicker on first load** → Mitigation: initialize theme before main UI paint and keep the algorithm simple.
- **System mode behavior can be confusing if OS theme changes while the page is open** → Mitigation: listen to `prefers-color-scheme` changes when the selected preference is `system`.

## Migration Plan

1. Introduce a shared theme preference model (`light`, `dark`, `system`) and early theme application logic.
2. Extend global CSS variables to define both light and dark token sets.
3. Add authenticated Settings navigation and build the Settings page with the appearance switch.
4. Update creator and public surfaces to rely on theme-aware tokens instead of fixed light-only colors where necessary.
5. Verify OS detection, explicit override behavior, and page-to-page consistency.

## Open Questions

- Should the theme preference also be reflected in the URL or remain fully local to the browser?
- Do we want the settings control presented as segmented buttons, radio cards, or a select-style control?
- Should future account-level persistence replace or complement browser-local persistence?
