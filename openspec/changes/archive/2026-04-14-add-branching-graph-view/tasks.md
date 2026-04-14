## 1. Graph mode entry and layout shell

- [x] 1.1 Add a graph-mode toggle button with branching icon next to the create-block action in the builder toolbar.
- [x] 1.2 Add builder state for entering and leaving graph mode while preserving the current form and selection context.
- [x] 1.3 Render a full-width graph workspace that hides the standard sidebar and editor layout while graph mode is active.

## 2. Graph data and visualization

- [x] 2.1 Add a graph data helper that converts saved blocks, default-next targets, and branch rules into graph nodes and edges.
- [x] 2.2 Implement deterministic left-to-right layout so linear forms render as a simple sequence and branched forms fan out from saved block order.
- [x] 2.3 Render graph nodes and edges with readable labels and selection states for blocks and routing relationships.

## 3. Graph-mode branching editing

- [x] 3.1 Add graph-mode controls for inspecting the selected block's default-next target and branch rules.
- [x] 3.2 Reuse the existing block branching save flow so graph-mode edits persist through current APIs and draft handling.
- [x] 3.3 Ensure graph-mode editing preserves existing branching validation and surfaces blocking/advisory issues consistently.

## 4. Verification

- [x] 4.1 Add unit coverage for graph data and layout derivation from linear and branched forms.
- [x] 4.2 Add interaction coverage for entering graph mode, leaving graph mode, and editing branching relationships from the graph workspace.
- [x] 4.3 Manually verify graph mode on linear and branched forms, including full-width layout behavior and save/validation flows.
