## Context

The current form system supports editorial blocks, free-text questions, and choice questions. The requested change expands that model with four structured question types: number, link, agreement, and date, and also adds optional custom regex validation for text-answer blocks. This touches multiple parts of the product at once: builder block creation and editing, runner input rendering and validation, response storage, and creator-facing response views such as exports.

The project already uses a shared block model across builder and runner. The least risky approach is to extend that existing model rather than introduce a second validation path per surface.

## Goals / Non-Goals

**Goals:**
- Add four new block kinds that creators can add from the builder.
- Add optional custom regex validation to text-answer blocks without introducing a separate regex block kind.
- Keep the builder experience consistent with existing question editing patterns.
- Enforce type-specific validation in the public runner before respondents can advance.
- Preserve answers for the new block types and regex-validated text answers in submission storage and creator review flows.
- Define agreement-block semantics clearly so `required` means the respondent must explicitly agree.

**Non-Goals:**
- Adding advanced numeric behavior beyond float toggling and min/max limits, such as custom step sizes, precision rules, or unit-aware formatting.
- Adding URL label previews, link unfurling, or remote URL verification.
- Adding date ranges, time-of-day support, or timezone-aware scheduling behavior.
- Adding a library of predefined regex templates beyond raw custom-pattern support.
- Introducing e-signature, legal document acceptance history, or compliance workflows beyond a boolean agreement answer.

## Decisions

### Decision: Extend the existing block-kind model with four new first-class kinds
- Add new block kinds instead of overloading existing short-text blocks with validation flags.
- This keeps builder menus, runner rendering, stored answers, and exports explicit and easier to reason about.
- Alternative considered: a generic text input with subtype validation. Rejected because it makes labels, icons, answer parsing, and response review more ambiguous.

### Decision: Use simple per-type validation with native-friendly inputs
- Number blocks accept numeric values only, with optional configuration for allowing floats and enforcing minimum/maximum bounds.
- Link blocks accept valid URL-like link input suitable for the product’s current public-form UX.
- Date blocks accept date values only.
- Agreement blocks store a boolean-style choice of agreed / not agreed.
- Text-answer blocks can optionally define a custom regex pattern used for additional validation.
- Alternative considered: adding richer validation rules at the same time. Rejected to keep the first release small and avoid overdesign.

### Decision: Model regex validation as an option on text-answer blocks
- Regex validation belongs on existing short-text and long-text style answer blocks instead of becoming its own block kind.
- This keeps the builder simpler and lets creators choose between plain text and constrained text within the same question type.
- Alternative considered: a dedicated regex block. Rejected because the main distinction is validation behavior, not a distinct respondent interaction model.

### Decision: Keep required semantics type-specific but consistent
- Existing required validation remains the base rule: respondents cannot advance without a valid answer.
- Agreement blocks are the one special case: when required, `not agreed` is treated as incomplete/invalid and only `agreed` satisfies the requirement.
- Alternative considered: treating any explicit agreement choice as a valid required answer. Rejected because it would make a required agreement block ineffective for consent collection.

### Decision: Reuse current response storage and review pipelines
- The new blocks should fit into the existing anonymous response model and export/review surfaces without introducing a separate submission system.
- Structured answers should be normalized into the existing saved-answer flow so downstream features can render them consistently.
- Alternative considered: custom per-type response records. Rejected because it would add migration and review complexity without clear product benefit.

## Risks / Trade-offs

- [Validation ambiguity for links] → Define one accepted URL format strategy in implementation and use the same validation on client and server.
- [Numeric parsing edge cases] → Use one normalized numeric-validation path so integer-only, float-allowed, min, and max rules behave the same in builder, runner, and submission validation.
- [Unsafe or confusing regex patterns] → Treat regex as creator-provided validation configuration with clear error handling and avoid introducing features that require complex expression parsing beyond runtime validation.
- [Inconsistent answer formatting in exports/review] → Normalize stored answer values so creator-facing surfaces render predictable text for number, link, agreement, and date answers.
- [Agreement wording may affect respondent clarity] → Keep the block’s answer options and validation behavior explicit in localized UI copy.
- [Date handling can drift across locales] → Store a normalized date value and render it consistently rather than depending on browser-specific display strings.

## Migration Plan

1. Extend the shared block type definitions and validation helpers for the new kinds, numeric constraints, and regex-enabled text validation.
2. Add builder support for creating and editing the new blocks, configuring float/min/max rules for number blocks, and configuring regex on text-answer blocks.
3. Add runner rendering and validation for the new answer types, numeric constraints, and regex-constrained text answers.
4. Verify stored responses, creator review, and export behavior for forms that include the new blocks or regex-validated text answers.
5. Ship without data migration for existing forms because this change only adds new block kinds and optional validation metadata.

Rollback is low risk: if needed, the new block kinds can be hidden from creation and their validation paths reverted before creators adopt them broadly.

## Open Questions

- Should link validation require fully qualified URLs such as `https://...`, or should bare domains be normalized during input handling?
- Should regex validation be available on both short text and long text, or only on short text in the first version?
- Should numeric min/max limits be inclusive by default? (current assumption: yes)
- Should the agreement block use fixed answer labels only, or allow creator-edited agreement text in a later change?
- Should date review/export surfaces use locale-specific formatting or a normalized ISO-like display by default?
