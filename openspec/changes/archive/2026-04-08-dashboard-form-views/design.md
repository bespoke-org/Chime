## Context

The creator dashboard currently renders forms in one card-based grid. That layout works well for visual browsing, but it is less efficient for creators with many forms who want denser scanning and quick comparison of status, response counts, and recency.

The requested change is purely within the creator dashboard surface. The dashboard already receives the full form list needed for the table columns, so the change can be implemented without new backend endpoints if sorting and view switching are handled in the dashboard UI layer.

## Goals / Non-Goals

**Goals:**
- Support two dashboard list presentations: grid and table.
- Make the existing card layout explicitly the grid view.
- Allow creators to switch between grid and table views from the dashboard.
- Allow sorting in table view by title, status, response count, and updated date.
- Preserve existing core actions such as creating a form, opening the builder, and reviewing responses.

**Non-Goals:**
- Persisting the selected view across devices or sessions.
- Server-side sorting or pagination.
- Bulk actions across forms.
- Replacing the existing grid layout.

## Decisions

### Implement view switching in the dashboard UI
The dashboard should offer a simple grid/table toggle in the existing management header area.

**Why this approach:**
- Keeps the interaction local to the dashboard where it is used.
- Avoids introducing unnecessary routing complexity for a presentational preference.
- Makes it easy to preserve the existing grid view as the default.

**Alternatives considered:**
- Separate routes for grid and table views: adds URL complexity for a lightweight display preference.
- Replace grid with table entirely: does not satisfy the request to keep both views.

### Use client-side sorting for table mode
Sorting should be handled in the dashboard presentation layer using the already loaded form list.

**Why this approach:**
- Existing dashboard data already includes the needed fields.
- Sorting is a view concern rather than a data-ownership concern.
- Avoids new API parameters or server coordination for the initial feature.

**Alternatives considered:**
- Server-side sorting via query params: more scalable for very large datasets, but unnecessary for the current scope.

### Keep grid as the initial/default view
The current dashboard experience should remain the starting point and simply be named grid.

**Why this approach:**
- Preserves familiarity for existing users.
- Minimizes product surprise while still enabling the denser table workflow.

**Alternatives considered:**
- Default to table for everyone: improves density but changes the current experience abruptly.

### Reuse existing form actions in both views
The table view should still let creators move directly into common workflows, especially opening the builder and viewing responses.

**Why this approach:**
- Prevents the table from becoming a read-only report.
- Maintains parity between views so changing the layout does not hide essential actions.

**Alternatives considered:**
- Make the table informational only: reduces usefulness and forces creators back to grid for actions.

## Risks / Trade-offs

- **Client-side sorting may be less scalable for very large form lists** → Mitigation: acceptable for current scope; revisit with server-side sorting if dataset size grows.
- **Adding toggle and sorting controls can clutter the dashboard header** → Mitigation: keep controls compact and aligned with the current management-focused design.
- **Two views can drift visually or functionally over time** → Mitigation: ensure both use the same underlying form data and expose the same critical actions.

## Migration Plan

1. Introduce dashboard view and sorting state in the dashboard UI.
2. Extract or add grid and table presentations over the same form list data.
3. Add sortable table headers for title, status, response count, and updated date.
4. Verify creators can switch views and still reach builder/response actions.
5. Confirm the default dashboard experience remains the current grid layout.

## Open Questions

- Should the selected view be remembered in local storage or left as a per-page-session preference for now?
- Should clicking a table row open the builder, or should actions remain button/link-based only?
- Should status sorting use raw enum order or a product-specific order such as published before draft?
