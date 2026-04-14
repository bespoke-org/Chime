## Why

The core form domain is now concentrated in a few oversized modules: `lib/forms.ts`, the builder surfaces, and the public runner. These areas carry most of the product’s behavior but do not yet have matching module boundaries or regression coverage, which makes routine changes riskier and slows down follow-up work.

## What Changes

- Add a phased refactor plan that reduces the size and responsibility spread of `lib/forms.ts`, `components/form-builder.tsx`, `components/form-builder-panels.tsx`, and `components/public-form-runner.tsx`.
- Extract cohesive domain helpers from `lib/forms.ts` into smaller, focused modules with stable interfaces.
- Break builder and runner behavior into smaller units so state, rendering, and side effects are easier to reason about and test.
- Expand automated test coverage around the current high-risk surfaces before and during refactoring so behavior remains stable.
- Preserve existing user-facing behavior while improving maintainability and regression protection.

## Capabilities

### New Capabilities
- `core-form-maintainability`: Internal quality requirements for module boundaries and regression coverage around the app’s core form flows.

### Modified Capabilities
- None.

## Impact

- Affected code: `lib/forms.ts`, `components/form-builder.tsx`, `components/form-builder-panels.tsx`, `components/public-form-runner.tsx`, related response review/export helpers, and new focused helper modules/tests.
- Affected systems: creator builder flow, public runner flow, response review shaping, and automated test suite coverage.
- No intended API, schema, or user-facing behavior changes.