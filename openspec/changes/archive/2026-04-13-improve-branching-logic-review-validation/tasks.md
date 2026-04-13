## 1. Operator-aware branching model

- [x] 1.1 Extend branch rule schemas and parsers to support explicit operators with legacy exact-match fallback
- [x] 1.2 Update shared branch evaluation helpers for the Practical v1 operator set across builder, runner, and submission validation
- [x] 1.3 Expand branch validation to classify publish blockers and advisory warnings for invalid, overlapping, or fragile rules

## 2. Builder authoring and validation UX

- [x] 2.1 Update branching controls to let creators choose operators and enter operator-specific operands
- [x] 2.2 Show only valid operators for the selected block type and handle operand-less operators such as `is empty`
- [x] 2.3 Surface blocking errors and advisory warnings clearly in the builder without preventing draft saves

## 3. Response review path visibility

- [x] 3.1 Extend response detail shaping to expose visited path and skipped blocks for branched submissions
- [x] 3.2 Update the creator response detail UI to display route context for visited and skipped blocks in submission order

## 4. Regression coverage

- [x] 4.1 Verify existing exact-match branching forms continue to work unchanged after operator support is added
- [x] 4.2 Verify advanced operator routing, warning/blocker behavior, and branched response review context end to end
