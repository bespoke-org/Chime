## 1. Branching domain model

- [x] 1.1 Extend block config types, parsers, and block update validation to support ordered `branchRules` on answerable blocks
- [x] 1.2 Add shared branch matching, next-block resolution, and graph validation helpers for forward-only routing and reachability checks
- [x] 1.3 Update form serialization/helpers so builder and public form payloads include branching data consistently without changing linear forms

## 2. Builder authoring and publish validation

- [x] 2.1 Add branching controls to the block editor for answerable blocks, including rule creation, target selection, and rule reordering
- [x] 2.2 Surface branch validation feedback in the builder while preserving draft edits that are not yet publishable
- [x] 2.3 Enforce publish-time branch validation in the form publish flow and return actionable errors for invalid targets or unreachable blocks

## 3. Branch-aware runner and submission

- [x] 3.1 Refactor the public runner to use visited-route history instead of a linear step index
- [x] 3.2 Update runner progress and back-navigation behavior so route changes after edited answers recalculate future steps correctly
- [x] 3.3 Update anonymous submission handling to resolve the visited route server-side and validate only visited required blocks

## 4. Regression checks

- [x] 4.1 Verify unchanged linear forms still build, publish, and submit exactly as before when no branch rules are configured
- [x] 4.2 Verify branched forms cover simple follow-up, divergent path, skipped required question, and backtracking scenarios end to end
