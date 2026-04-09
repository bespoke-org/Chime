## Context

The recent settings redesign established a cleaner creator UI language with fewer nested surfaces and less visual stacking, but the form builder still uses a heavier panel treatment. Because the builder is one of the most frequently used creator surfaces, the mismatch is now more noticeable.

The current builder also lets the block list define page height. On long forms, the left column keeps extending downward while the right editor area often leaves large empty zones in the viewport, making the whole page feel unbalanced and forcing more scrolling than necessary.

## Goals / Non-Goals

**Goals:**
- Make the form builder feel visually closer to the newer settings UI.
- Reduce unnecessary surface layering, nested cards, and decorative separation in the builder.
- Keep the master-detail editing model intact.
- Make the left block/navigation column scroll independently for long forms.
- Preserve the existing editing, publishing, and response-review workflows.

**Non-Goals:**
- Changing the supported block types or editing capabilities.
- Reworking form validation, persistence, or public runner behavior.
- Turning the builder into a fully split-pane resizable layout.
- Introducing a new design system or dependency.

## Decisions

### 1. Keep the builder as a two-column master-detail layout
The builder should stay structurally familiar: block navigation on the left, detail editor on the right. The change is about better balance and calmer presentation, not a new interaction model.

**Alternatives considered:**
- Collapse into a single-column accordion/editor flow: rejected because it would slow down navigation for larger forms.
- Move block navigation into a drawer: rejected because constant access to block order is central to the builder experience.

### 2. Make the left block list independently scrollable within the viewport
Instead of letting the block list continue growing the whole page, the builder should constrain the navigation column and allow its list area to scroll independently.

**Why:**
- Long forms stay manageable.
- The right editor panel remains meaningfully present while navigating deep block lists.
- The page avoids becoming disproportionately tall.

**Alternatives considered:**
- Let the entire page scroll only: rejected because it creates large empty regions beside shorter editor panels.
- Make both panes fixed-height and independently scrollable everywhere: rejected because the editor side should remain more natural for variable settings content.

### 3. Reduce nested surface treatments inside the builder
The builder should remove or soften extra card-within-card patterns, excessive borders, and layered elevation where they are not helping comprehension.

**Why:**
- Matches the flatter, more intentional settings redesign.
- Keeps focus on content hierarchy rather than container hierarchy.
- Makes dense editing screens feel lighter.

**Alternatives considered:**
- Remove all panel distinction entirely: rejected because the builder still benefits from clear left/right structural separation.

### 4. Use section dividers and spacing before adding new containers
Where the current UI uses stacked boxes for separation, prefer spacing, typographic hierarchy, and divider lines first.

**Why:**
- Produces a calmer editing surface.
- Reduces visual clutter without losing structure.

### 5. Preserve mobile friendliness even if scroll behavior is desktop-oriented
Independent pane scrolling should be primarily a desktop/tablet enhancement. On smaller screens, the builder should remain functional and avoid brittle fixed-height behavior.

**Alternatives considered:**
- Force the same constrained-height behavior on every breakpoint: rejected because it risks awkward small-screen interactions.

## Risks / Trade-offs

- **Independent left-column scrolling can feel disconnected if not visually obvious** → Keep the navigation panel boundary clear and ensure the scroll region is naturally discoverable.
- **Reducing layers too aggressively can make sections blur together** → Preserve strong hierarchy with headings, spacing, and selective borders.
- **Viewport-constrained heights can be fragile with sticky headers or browser chrome** → Use resilient CSS sizing and test across common creator screen sizes.
- **Long editor content may still require page scrolling** → Accept this; the primary problem to solve is runaway page height from the block list, not removing page scroll entirely.

## Migration Plan

- No database or API migration is required.
- Update builder layout and supporting components together so the new visual system and scroll behavior ship consistently.
- If rollback is needed, the builder can revert to the previous layout without affecting saved data.

## Open Questions

- Whether the left column should have a fixed max height or a viewport-relative sticky layout. Initial recommendation: viewport-relative constrained layout.
- Whether add-block controls should remain inside the same scroll region as the block list or be pinned within the sidebar. Initial recommendation: keep them visible without excessive scrolling if practical.
