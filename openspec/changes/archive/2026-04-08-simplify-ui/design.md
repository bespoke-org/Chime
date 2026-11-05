## Context

Chime already supports the core creator and respondent workflows, but several key surfaces still read like a promotional landing experience rather than a focused internal tool. The current home page, login screen, creator layout, dashboard, and builder all use decorative gradients, showcase blocks, and persuasive copy that add visual weight without adding functional value.

This change is intentionally presentation-only. The routes, auth model, data flow, and builder/respondent behavior stay the same. The design work therefore needs to be implemented by simplifying component structure, trimming copy, and tightening visual styling without disturbing existing user flows.

## Goals / Non-Goals

**Goals:**
- Make the home page a concise product entry surface with clear next actions.
- Remove or reduce decorative sections, promotional messaging, and showcase panels from entry and creator-facing surfaces.
- Align the creator shell, dashboard, and builder with a quieter, more utility-first visual language.
- Preserve all current workflows, routes, and permissions while changing only presentation and copy emphasis.

**Non-Goals:**
- Changing authentication, publishing, response review, or form submission behavior.
- Redesigning the underlying builder interaction model or adding new product capabilities.
- Reworking the public runner experience beyond any styling inherited from shared tokens.
- Introducing a new design system, dependency, or theming framework.

## Decisions

### Decision: Simplify in place rather than introducing a separate "minimal" theme
The implementation will update the existing pages and shared styling tokens directly instead of adding a mode switch or alternate theme.

**Rationale:** The request is to move the product in a clearer minimal direction overall, not to support multiple visual identities. Updating the existing surfaces avoids unnecessary complexity and keeps future maintenance simple.

**Alternatives considered:**
- Add a second theme or style variant: rejected because it introduces maintenance overhead for a single desired direction.
- Limit the change to copy only: rejected because the visual hierarchy and decorative layouts also contribute to the ad-like feel.

### Decision: Preserve page structure and routes while reducing section count and chrome
The home page, login page, dashboard, creator layout, and builder will keep their current route responsibilities, but unnecessary secondary sections and large promotional headers will be collapsed into compact, action-oriented layouts.

**Rationale:** This preserves behavior and navigation while delivering the requested tone shift with low implementation risk.

**Alternatives considered:**
- Merge or remove routes entirely: rejected because the problem is presentation, not information architecture.
- Leave layouts intact and only shorten text: rejected because oversized hero treatments and showcase cards would still dominate the experience.

### Decision: Use concise functional copy as a product rule on key surfaces
Labels and helper text on the affected surfaces will describe what the user can do next, not why the product is appealing.

**Rationale:** The primary complaint is that the interface feels like an ad. Functional copy directly addresses that without changing capabilities.

**Alternatives considered:**
- Keep existing poetic brand voice in a lighter form: rejected because it still risks reading as promotional.
- Remove nearly all copy: rejected because users still need short contextual cues for auth, dashboard actions, and builder state.

### Decision: Reduce ornamental global styling before tuning page-level components
Global background treatments, glassmorphism effects, and strong decorative gradients will be softened or removed first, then page components will be simplified to match.

**Rationale:** A minimal tone will not hold if page markup is simplified but the shared visual environment remains highly styled.

**Alternatives considered:**
- Only update individual components: rejected because the background and shared surfaces would keep the same overall mood.

## Risks / Trade-offs

- **Risk:** Over-simplifying could make the app feel unfinished rather than intentionally minimal. → **Mitigation:** Keep strong spacing, typography, and clear action grouping even while removing decorative sections.
- **Risk:** Copy reductions could remove useful orientation for first-time creators. → **Mitigation:** Replace promotional text with short task-oriented guidance instead of deleting context entirely.
- **Risk:** Shared style token changes could unintentionally affect lower-priority screens. → **Mitigation:** Validate all major surfaces after token updates and use local overrides where shared simplification causes regressions.
- **Risk:** Minimal dashboard and builder chrome may reduce visual separation between sections. → **Mitigation:** Preserve information hierarchy through borders, spacing, headings, and status/action clusters rather than decorative cards.

## Migration Plan

- Implement as a standard UI-only change with no schema, API, or data migration.
- Validate the home page, login page, dashboard, builder, responses, and public form runner visually before merge.
- Roll back by reverting the changed UI files if the reduced treatment removes needed clarity.

## Open Questions

- None at proposal time; the requested direction is specific enough to proceed with implementation decisions during the apply phase.