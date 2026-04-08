## Why

The current UI leans toward a polished landing-page aesthetic with promotional copy, decorative panels, and feature-selling language. For this project, that tone distracts from the actual goal: letting creators get in, manage forms, and review responses with as little friction and visual noise as possible.

## What Changes

- Simplify the public home page so it acts as a direct entry point into the product instead of a marketing surface.
- Remove promotional sections and ad-like framing such as feature sales copy, showcase panels, and non-essential product-surface highlights.
- Simplify creator-facing chrome in the authenticated layout and dashboard so navigation emphasizes core actions over descriptive brand messaging.
- Replace decorative or persuasive copy with short, functional labels and guidance across key entry surfaces.
- Reduce ornamental visual treatments where they compete with clarity, while preserving the existing product functionality and route structure.

## Capabilities

### New Capabilities
- `minimal-ui-surfaces`: Defines a minimal, utility-first presentation for the home page, login page, creator layout, and dashboard so core actions remain clear without promotional framing.

### Modified Capabilities
- `conversational-form-builder`: Align the creator builder surface with the same minimal product chrome and reduce non-essential explanatory copy around editing actions.

## Impact

- Affected code: `app/page.tsx`, `app/login/page.tsx`, `app/(creator)/layout.tsx`, `app/(creator)/dashboard/page.tsx`, `components/empty-state.tsx`, `components/form-builder.tsx`, and shared visual styling in `app/globals.css`.
- No API, database, auth, or dependency changes are expected.
- Existing routes and creator/respondent workflows remain intact; this change is limited to presentation, copy, and interface emphasis.