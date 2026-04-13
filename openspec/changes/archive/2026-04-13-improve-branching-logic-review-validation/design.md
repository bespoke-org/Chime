## Context

The initial branching change adds forward-only routing, default next targets, and visited-path runner state, but branch conditions are still intentionally narrow: most blocks only support exact-match semantics. That keeps the first release simple, yet it leaves common real-world routing needs unsolved, such as numeric thresholds, blank-answer handling, or substring matching.

At the same time, creators currently have limited visibility into what happened after a branched response is submitted. The response review flow can show visited blocks because the submission snapshot already preserves the visited path, but it does not explicitly label the route taken or the sections skipped. Validation is also mostly structural. It blocks obviously invalid graphs, but it does not help creators identify fragile logic, overlapping conditions, or dead-end coverage risks before publishing.

This follow-up change is cross-cutting because it affects branch rule storage, builder authoring, publish validation, runner evaluation, and response review presentation.

## Goals / Non-Goals

**Goals:**
- Expand branching with a practical v1 operator set that covers common qualification and routing use cases.
- Keep routing deterministic and forward-only.
- Show creators the visited route and skipped sections for a submitted response.
- Strengthen validation with clearer branching warnings and publish-time blockers.
- Preserve compatibility for existing exact-match branch rules.

**Non-Goals:**
- Adding a full visual graph canvas.
- Supporting arbitrary boolean groups, nested AND/OR logic, or user-defined expressions.
- Adding branching analytics dashboards in this change.
- Introducing backward jumps or loops.
- Reworking the persistence model away from per-block JSON config.

## Decisions

### 1. Extend branch rules with an explicit operator field
Move branch rules from implicit type-specific matching to an explicit rule shape such as:
- `operator`: enum
- `value`: optional operand when the operator needs one
- `targetBlockId`: later block target

Initial operator set:
- all answerable blocks: `equals`, `not_equals`, `is_empty`, `is_not_empty`
- short/long text and link: `contains`
- multiple choice: `contains_any`
- number and date: `gt`, `gte`, `lt`, `lte`

Why this approach:
- Keeps the model evolvable without inventing a second rule format later.
- Lets the builder present operator-appropriate controls and validation.
- Preserves deterministic first-match evaluation.

Alternatives considered:
- Continue inferring operators from block type alone: too limiting for the requested scope.
- Introduce a generic expression DSL: too complex for the next iteration.

### 2. Preserve backward compatibility by upgrading legacy exact-match rules in parsing
Existing branch rules created by the first branching change should continue to work. Parsing should treat legacy exact-match rules as `equals` rules when no operator is present.

Why this approach:
- Avoids breaking saved draft or published forms.
- Keeps the migration lightweight because branch data lives in JSON config.

Alternatives considered:
- Require a one-time data migration over all forms: unnecessary complexity for JSON-backed config.

### 3. Separate validation into publish blockers and advisory warnings
Validation should continue blocking publish for hard graph errors, while also surfacing non-blocking warnings during editing. Proposed split:

**Blockers:**
- missing target
- backward/self target
- unreachable block
- invalid operand for the chosen operator
- operator not supported by the source block type
- no valid continuation from a required route branch where the graph dead-ends unexpectedly before remaining reachable required content is satisfiable

**Warnings:**
- overlapping rules where a broader earlier rule makes a later rule effectively unreachable
- exact-match text/link rules that may be fragile
- choice blocks whose rule coverage is partial and fall through to a default route unexpectedly
- stale branch references caused by reorder/delete operations while still in draft

Why this approach:
- Keeps publish safety strict without making authoring unbearably rigid.
- Helps creators debug complex flows earlier.

Alternatives considered:
- Make every warning a blocker: too frustrating for draft authoring.
- Keep only blockers: not enough guidance for advanced branching.

### 4. Use the response snapshot plus current form order to show route context
Response review should derive path context from the visited block snapshot already stored on submission and compare it against the full form structure in saved order. The UI can then show:
- visited path in order
- blocks skipped by branching
- the answer shown on each visited decision point

Why this approach:
- Avoids adding a new response table or separate route log.
- Keeps review faithful to what the respondent actually saw at submission time.

Alternatives considered:
- Store a separate explicit branch-events log: richer, but unnecessary for the initial review improvement.

### 5. Keep runner evaluation server/client shared through the branching domain layer
The same rule-resolution helper should evaluate advanced operators for both client navigation and server-side submission validation.

Why this approach:
- Prevents drift between what respondents see and what the server accepts.
- Keeps advanced operator semantics consistent across review and validation.

Alternatives considered:
- Duplicate evaluation logic in the client and server: more fragile and harder to test.

## Risks / Trade-offs

- **More operators increase builder complexity** → Mitigation: scope the operator set tightly and show only operators valid for the selected block type.
- **Advisory warnings can be noisy** → Mitigation: limit warnings to high-signal cases and distinguish them clearly from publish blockers.
- **Legacy exact-match rules could behave unexpectedly if interpreted differently** → Mitigation: map legacy rules only to `equals` semantics and keep normalization deterministic.
- **Skipped/visited route display may confuse creators if the current form has changed since submission** → Mitigation: anchor visited-path display to the stored snapshot and use the current form only for supplemental skipped-block context.

## Migration Plan

1. Extend branch rule parsing/types with operator-aware schemas and legacy fallback support.
2. Update shared branch evaluation and validation helpers for the practical v1 operator set.
3. Expand builder authoring UI to choose operators, operands, and show validation warnings/blockers clearly.
4. Update response review shaping to expose visited and skipped route context.
5. Verify existing exact-match branch forms continue to work unchanged.

Rollback strategy:
- If needed, hide advanced operators in the builder and continue honoring already-saved `equals` behavior. Because the model remains JSON-based, rollback does not require destructive schema reversal.

## Open Questions

- Should response review explicitly show which branch rule fired, or is visited/skipped context enough for the first pass?
- Which warning conditions should remain advisory versus becoming publish blockers after creator feedback?
- Do we want date comparisons to interpret values strictly as local calendar dates or normalized UTC date strings in every surface?
