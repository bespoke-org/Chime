## Context

Chime currently stores form structure as an ordered list of `FormBlock` records, with block-specific settings serialized in each block's `config` JSON. The creator builder edits one block at a time, and the public runner assumes a strictly linear progression by incrementing a numeric step across `form.blocks`.

Branching is a cross-cutting change because it touches block configuration parsing, builder editing UI, publish validation, runner navigation state, and submission-time validation. The current architecture is a good fit for an incremental implementation because blocks already have stable IDs and a JSON config surface that can absorb routing metadata without introducing a new top-level table.

Key constraints:
- Public forms are anonymous and already validate answers both client-side and server-side.
- The builder already saves block configuration per block and reuses stable block IDs across reorder operations.
- The current runner and server submission path both assume every block in saved order is part of the respondent journey, which must change for branching to work.
- The requested behavior needs to cover both simple conditional follow-ups and larger divergent paths, but should avoid infinite loops or graph states that are hard to reason about in v1.

## Goals / Non-Goals

**Goals:**
- Let creators define branching from an answerable block to any later block in the form.
- Support simple follow-up questions and multi-branch flows using the same routing model.
- Keep forms without branching working exactly as they do today.
- Enforce deterministic routing in the public runner and on the submission API.
- Block publishing when branch targets are invalid or the graph leaves blocks unreachable from the form start.
- Preserve reliable back navigation when a respondent revisits earlier answers.

**Non-Goals:**
- Supporting backward jumps, loops, or arbitrary cyclic graphs.
- Adding a visual canvas or node-editor UI in v1.
- Introducing complex condition builders such as numeric ranges, boolean groups, or nested AND/OR logic.
- Changing creator response review beyond what is necessary for branching-safe submissions.
- Versioning published form graphs independently from the draft form model.

## Decisions

### 1. Store branch rules inside each block's existing `config` JSON
Add a shared branching shape to answerable block configs rather than introducing a separate `FormBranch` table.

Proposed model:
- Every answerable block may include `branchRules: BranchRule[]` inside `config`.
- Each rule references a target `blockId` and a condition value interpreted according to the source block type.
- Every answerable block may also include `defaultNextBlockId`, which overrides the normal next-in-order fallback when no branch rule matches and also enables unconditional forward jumps after a question.
- When `defaultNextBlockId` is not set, the runner continues to the next block in saved order.
- Text blocks remain non-answerable and do not expose branch editing.

Why this approach:
- Fits the existing block-centric editing flow and API shape.
- Avoids a database migration for the initial feature.
- Keeps branch rules naturally attached to the question that decides the route.

Alternatives considered:
- A separate relational edge table: more normalized, but adds migration, joins, and more complex CRUD for an initial release.
- A form-level graph document: more flexible, but less aligned with the current block editor and harder to update incrementally.

### 2. Scope v1 routing to forward-only jumps to later blocks
A branch target or configured default next target may point only to a later block in saved order. When no explicit default next target is configured, the implicit fallback remains the next block in saved order.

Why this approach:
- Still satisfies the requested jump-to-X branching for practical form flows.
- Prevents infinite loops and ambiguous revisit semantics.
- Makes validation and route resolution much simpler.

Alternatives considered:
- Allow arbitrary targets, including previous blocks: more expressive, but creates loop detection, repeated-answer semantics, and progress complexity that are not needed for v1.
- Restrict branching to only the immediately next question: too limiting for the requested divergent paths.

### 3. Use simple block-type-aware match conditions instead of a full rule engine
Branch conditions should match the current block's answer using a small set of predictable operators:
- short text / long text / number / link / date: exact normalized value match
- single choice / agreement: exact selected value match
- multiple choice: contains selected option

Rules are evaluated in saved order, and the first matching rule wins.

Why this approach:
- Covers the user request for answer-based branching without building a complex expression language.
- Keeps both builder UI and server validation understandable.
- Gives deterministic behavior for multiple-choice blocks where more than one rule could match.

Alternatives considered:
- Add full comparator support (`>`, `<`, regex, AND/OR groups): powerful, but too large for the first branching release.
- Allow all matching rules to fire: ambiguous when rules target different blocks.

### 4. Validate branch integrity centrally and enforce it at publish time
Introduce a shared graph validation helper used by builder APIs and publish logic. Draft forms may retain invalid branch rules while being edited, but publish MUST fail until issues are resolved.

Validation should cover:
- branch targets and configured default next targets exist
- every target is later than the source block
- no duplicate or impossible rule shapes for the same block type
- every block remains reachable from the first block through at least one possible route

Why this approach:
- Lets creators reorder and edit complex forms without destructive auto-fixes.
- Keeps the hard safety boundary at publish time, where invalid graphs would affect respondents.
- Centralizes logic so the client and server do not drift.

Alternatives considered:
- Reject invalid drafts on every edit: safer but more frustrating during multi-step authoring.
- Auto-delete invalid rules during reorder/delete: simpler operationally, but surprising and lossy.

### 5. Change runner state from numeric linear step to visited-route history
Replace the runner's single `step` index over `form.blocks` with route-aware state:
- `history: string[]` of visited block IDs in order
- `cursor` pointing at the current visited block
- `answers` as today

Advance flow:
1. validate the current visited block
2. resolve the next block from the current answer and branch rules
3. if the respondent had gone back, truncate forward history before appending the new branch result
4. move to the next visited block or submit if no next block exists

Why this approach:
- Supports deterministic back navigation across the actual path taken.
- Correctly recalculates future steps when a respondent changes an earlier answer.
- Avoids leaking skipped blocks into the active route.

Alternatives considered:
- Recompute the entire full route from scratch on every render: possible, but harder to preserve intuitive back behavior.
- Keep a linear numeric index and just skip hidden blocks: brittle once respondents go back and alter branch decisions.

### 6. Validate and persist only visited blocks during submission
The submission API should resolve the respondent's visited route using the same branch engine as the client and validate only blocks that were actually visited. Skipped required questions must not block submission.

Why this approach:
- The current server validation iterates over every block in saved order, which would incorrectly reject branched submissions.
- Server-side route resolution prevents clients from bypassing required questions on the active branch.

Alternatives considered:
- Trust the client-provided route history: simpler, but weaker from an integrity standpoint.
- Keep validating every block and mark branched ones optional: incorrect and hard to reason about.

### 7. Replace full-form percentage with route-relative progress
Because future branches are not always knowable before later answers are given, the runner should present progress relative to the visited route rather than a precise percentage over all saved blocks.

Why this approach:
- Avoids misleading totals when large sections are skipped.
- Keeps progress honest when a prior answer changes the remaining route.

Alternatives considered:
- Keep percentage over the full saved block list: inaccurate for heavily branched forms.
- Predict the entire remaining route ahead of time: unreliable when future routing depends on unanswered questions.

## Risks / Trade-offs

- **Branch rules stored in JSON are less queryable than relational edges** → Mitigation: acceptable for v1 because routing is resolved per form load, not through global reporting queries.
- **Reordering blocks can temporarily invalidate existing branch targets** → Mitigation: preserve draft edits, surface validation issues, and enforce correctness at publish time.
- **First-match rule evaluation may surprise creators if multiple rules could match** → Mitigation: make rule order explicit in the builder and document that evaluation is top-to-bottom.
- **Open-input branching based on exact matches may be less powerful than users eventually want** → Mitigation: design the rule shape so richer comparators can be added later without changing the overall graph model.
- **Route-relative progress is less precise than a classic total-step meter** → Mitigation: favor correctness and consistency over a misleading exact percentage.

## Migration Plan

1. Extend block config parsing/types with shared `branchRules` support for answerable blocks.
2. Add shared branch matching and graph validation helpers in the server/domain layer.
3. Update builder APIs and editor UI to create, edit, and validate branch rules against current form blocks.
4. Update publish validation to reject invalid branch graphs.
5. Refactor the public runner to use visited-route history and branch-aware progression.
6. Refactor submission handling to resolve and validate only the visited route.
7. Verify linear forms still behave identically when no branch rules are configured.

Rollback strategy:
- If the feature must be rolled back before broad usage, ignore `branchRules` in the runner and hide builder controls. Because the data stays in JSON config, rollback does not require a destructive schema reversal.

## Open Questions

- Should the creator builder eventually show a lightweight route preview or mini-map in addition to per-block rule editing?
- Should response review later distinguish between skipped blocks and unanswered visited blocks more explicitly?
- Do we want richer comparators such as numeric ranges or regex-based routing after the initial exact-match release?
