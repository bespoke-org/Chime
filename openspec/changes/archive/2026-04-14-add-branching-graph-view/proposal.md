## Why

Branching is currently configured through per-block settings, which makes it hard to understand the overall flow of a form once multiple paths are involved. A dedicated graph view would let creators see the full branching structure at once and move between routing relationships more confidently.

## What Changes

- Add a branching graph entry point next to the existing create-block action in the builder toolbar.
- Add a full-width graph view for branching configuration that temporarily replaces the normal sidebar-based builder layout.
- Represent each block as a node laid out from left to right, with edges for saved default-next and branch-rule targets.
- Keep linear forms readable in the graph view by laying blocks out left to right even when no branching is configured.
- Allow creators to inspect and manage branching relationships from the graph-focused interface while preserving existing branching rules and validation behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: extend builder behavior to include a graph-based branching view and graph-specific navigation for configuring routing relationships.

## Impact

- Affected code: builder layout, branching settings UI, graph rendering components, builder navigation controls, and related interaction tests.
- APIs: no new external API is expected; the feature should continue using the existing block and branching save flows.
- Dependencies/systems: likely frontend-only unless a graph-specific serialization need is discovered during implementation.
