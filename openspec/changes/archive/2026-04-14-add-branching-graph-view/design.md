## Context

Branching is already supported in the conversational form builder, but configuration is centered on the currently selected block and its inspector controls. That works for isolated edits, yet it becomes difficult to reason about the overall route structure when a form has multiple branch paths, shared targets, or unreachable sections.

The requested change adds a graph-first branching workspace that creators can open from the builder chrome. The graph view must use the full available page width, temporarily hide the usual sidebar-based builder layout, and keep the form readable even when the form is still purely linear.

The existing branching model, save APIs, publish validation, and block ordering rules already define the source of truth. The graph view should therefore be a new interaction layer over existing block and branch data rather than a parallel persistence model.

## Goals / Non-Goals

**Goals:**
- Give creators a graph-based view of the form's branching structure.
- Add a clear entry point next to the existing create-block action.
- Use a full-width workspace that prioritizes graph readability over the normal sidebar layout.
- Lay out nodes from left to right according to saved block order so linear and branched forms are both understandable.
- Allow creators to inspect and edit branching relationships without introducing a second branching system.
- Reuse existing branch validation and save semantics.

**Non-Goals:**
- Replacing the standard block editor as the default builder mode.
- Introducing freeform graph editing with arbitrary node placement persistence.
- Changing the meaning of existing branch rules, default-next behavior, or publish validation.
- Adding respondent-facing graph visualizations.
- Redesigning unrelated builder settings outside the branching workflow.

## Decisions

### 1. Add a dedicated graph mode toggle in the builder toolbar
The builder will expose a compact branching button beside the existing create-block action. Activating it switches the builder into a graph-focused mode; exiting returns the creator to the standard builder layout.

**Why:** This keeps branching discoverable without making graph mode the default experience for simple forms.

**Alternatives considered:**
- Put graph mode inside each block's branching editor: rejected because it hides a form-level workflow inside a block-level surface.
- Replace the default builder with a graph view: rejected because most day-to-day edits are still block-content edits.

### 2. Build the graph from existing ordered block and branching data
Each node will correspond to a saved block in form order. Edges will be derived from the saved default-next target and each saved branch rule target. The horizontal flow will follow block order from left to right, while branching paths can create vertical separation as needed.

**Why:** This preserves one source of truth and ensures the graph reflects the same routing model used for saving, validation, and respondent execution.

**Alternatives considered:**
- Store separate graph nodes and edges: rejected because it would duplicate routing state and create sync risk.
- Use free-drag placement as the canonical layout: rejected because the request is about understanding flow, not maintaining manual diagrams.

### 3. Use deterministic auto-layout instead of user-saved node positions
The graph should compute positions from block order and branching relationships each time it renders. Linear forms will therefore appear as a simple left-to-right chain, while branched forms will fan outward only where routing requires it.

**Why:** Deterministic layout avoids persistence complexity and keeps the graph stable across sessions.

**Alternatives considered:**
- Persist custom coordinates per block: rejected as unnecessary complexity for the first version.
- Render a simple list with connectors: rejected because it would not provide enough spatial clarity for richer branch graphs.

### 4. Keep editing bound to existing branch rule operations
Graph interactions should map back to the current branching model: selecting a node or edge opens graph-mode controls for editing branch rules or default-next behavior using the same rule schema already enforced elsewhere. Saving from graph mode should use the existing block save flows.

**Why:** This avoids creating different rule semantics between the inspector view and graph view.

**Alternatives considered:**
- Make graph mode read-only in the first version: rejected because the request is for a branching settings interface, not only visualization.
- Create graph-specific mutation APIs: rejected because existing block update APIs already own branching persistence.

### 5. Graph mode temporarily replaces the sidebar layout
When graph mode is active, the normal left block list and standard editor sidebar will be hidden so the graph can take the full page width. Graph-specific actions and context will live in the graph workspace itself.

**Why:** The graph needs the width that the normal two-pane layout would otherwise consume, and the request explicitly calls for the sidebar to be hidden.

**Alternatives considered:**
- Keep the sidebar visible beside the graph: rejected because it reduces graph readability and conflicts with the requested layout.
- Open the graph in a modal: rejected because large branching structures need a persistent full-screen workspace.

## Risks / Trade-offs

- **Dense graphs may still become visually busy** → Use deterministic spacing, directional edges, and focus/selection states to keep active paths readable.
- **Dual editing surfaces can drift behaviorally** → Reuse the same branch-rule data model, validation, and save pipeline in both standard and graph modes.
- **Full-width graph mode may hide useful navigation context** → Provide an obvious exit back to the standard builder and preserve the last selected block when returning.
- **Auto-layout may not match every creator's mental model** → Favor stable order-based positioning so the graph stays predictable, even if it is less customizable.

## Migration Plan

- No data migration is required because the graph is derived from existing form blocks and branch configuration.
- Rollback is low risk: disabling graph mode leaves the current builder and saved branching data unchanged.

## Open Questions

- Whether graph mode should support creating new branch rules directly from edge handles, or start with selection-driven editing only.
- Whether graph mode needs viewport controls such as zoom-to-fit and minimap in the first implementation, or whether panning plus fit-on-open is sufficient.
