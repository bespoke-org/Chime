## Context

The project’s most behavior-heavy paths now sit inside a small number of very large files. `lib/forms.ts` mixes persistence, validation, submission, response review shaping, and export-adjacent concerns. The builder is split across two large, state-heavy components. The public runner combines route state, validation, draft persistence, keyboard behavior, submission, and rendering in one component. Test coverage exists for some pure helpers, but coverage is still sparse around these critical surfaces.

This change is intentionally phased. The goal is to reduce complexity without introducing large behavior shifts or destabilizing the app. The safest path is to add or strengthen behavior-focused tests first, then extract cohesive seams, then simplify the largest UI surfaces around those seams.

## Goals / Non-Goals

**Goals:**
- Reduce responsibility concentration in `lib/forms.ts` by extracting cohesive domain helpers.
- Create smaller, more focused seams inside builder and runner code so future changes do not require editing giant files.
- Add regression coverage around current high-risk form behavior before and during refactors.
- Keep existing user-visible behavior stable while refactoring.
- Sequence work in reviewable phases with clear checkpoints.

**Non-Goals:**
- Re-designing the builder UX or public runner UX.
- Changing persistence models, response schemas, or public API contracts.
- Replacing the current builder or runner architecture in one large rewrite.
- Solving all UI duplication and infrastructure cleanup in the same change.

## Decisions

### 1. Use a test-first seam-extraction approach
Start each phase by locking current behavior with focused tests, then extract the underlying logic into smaller modules.

Why:
- Reduces regression risk while moving logic out of large files.
- Lets the refactor stay product-behavior based rather than implementation-led.
- Makes it easier to stop after each phase with a stable intermediate state.

Alternatives considered:
- Refactor first and backfill tests later: faster initially, but too risky for these high-behavior surfaces.
- Full rewrite of builder/runner: too disruptive and difficult to review safely.

### 2. Start with `lib/forms.ts` before builder and runner splits
Begin by extracting the most cohesive, testable domains out of `lib/forms.ts`, especially response review/response detail shaping and submission-adjacent helpers.

Why:
- `lib/forms.ts` is the central domain bottleneck and affects multiple downstream surfaces.
- Shared helpers created here can simplify both builder and runner work later.
- This phase is lower-risk than starting with the most stateful client components.

Alternatives considered:
- Start with builder splitting: valuable, but the builder depends on several domain helpers that are still too concentrated.
- Start with runner splitting: valuable, but runner state changes are harder to test safely before domain seams improve.

### 3. Split UI surfaces by stateful behavior boundaries, not purely by JSX size
When refactoring builder and runner, split along meaningful responsibility lines such as route state, submission behavior, draft persistence, editor section behavior, and specialized rendering.

Why:
- Avoids moving complexity into many shallow presentational files without reducing coupling.
- Produces seams that are easier to test and reuse.

Alternatives considered:
- Split by arbitrary visual sections only: reduces file size, but often preserves hidden coupling and cross-component state churn.

### 4. Prefer pure helper modules for behavior that feeds multiple UI surfaces
If logic is shared across review pages, exports, builder state mapping, or runner state mapping, extract a pure helper module and test it directly.

Why:
- Shared pure modules give the best payoff for regression coverage.
- Prevents drift between summary/detail/export or between client/server validation paths.

Alternatives considered:
- Keep logic inline near each caller: simpler short term, but increases drift and maintenance cost.

## Risks / Trade-offs

- **Incremental refactors can leave temporary intermediate seams** → Mitigation: keep phases small and behavior-locked with tests before/after extraction.
- **Additional tests may initially feel slower than direct code cleanup** → Mitigation: focus coverage on high-risk behavior rather than snapshot-heavy or implementation-coupled tests.
- **Large files may still remain large after first-phase extractions** → Mitigation: treat the change as phased and measure progress by responsibility reduction, not only raw line count.
- **Builder and runner client-component tests can become brittle** → Mitigation: favor pure helper extraction first and add UI tests only around stable user contracts.

## Migration Plan

1. Add or strengthen behavior-focused tests around existing form-domain behavior.
2. Extract cohesive helpers from `lib/forms.ts` into focused modules with direct tests.
3. Update callers to use the extracted modules while preserving output shapes.
4. Apply the same pattern to builder seams, starting with draft/state mapping logic before larger component splits.
5. Apply the same pattern to public runner seams, starting with route/progress/validation-adjacent helpers where practical.
6. Keep checks green after each phase (`format`, `lint`, `typecheck`, targeted tests, build when needed).

Rollback strategy:
- Because the change is phased and intended to preserve behavior, each phase can be reverted independently by restoring the previous module wiring and keeping the added tests as regression references where still applicable.

## Open Questions

- Which builder subdomain should be extracted first after `lib/forms.ts`: metadata editor behavior, choice/branch rule drafting, or mutation orchestration?
- How much of runner behavior should move into pure helpers versus smaller local hooks/components?
- Whether to add lightweight route-level/API tests during this change or defer them until the core extractions are complete.