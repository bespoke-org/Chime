## Context

Chime currently stores author-written content such as question descriptions and text block bodies as plain strings and renders them directly in the public runner and creator-facing response review screens. This keeps storage simple, but it prevents authors from adding lightweight structure or emphasis without introducing custom styling or extra blocks.

This change needs to improve readability while preserving the existing data model and avoiding unsafe HTML rendering. The same authored content appears in multiple UI surfaces, so the rendering approach should be shared rather than duplicated. The requested scope is limited to author-written content only; respondent-submitted free-form answers remain plain text.

## Goals / Non-Goals

**Goals:**
- Support a constrained Markdown subset for question descriptions and text block bodies.
- Render authored Markdown consistently in the public runner and creator response review/detail views.
- Keep existing stored content as plain strings with no schema or content migration requirements.
- Prevent unsafe HTML injection and keep output visually consistent with the current product style.
- Make the supported Markdown surface explicit so authors know what formatting is expected to work.

**Non-Goals:**
- Rendering Markdown in respondent-submitted short-text or long-text answers.
- Supporting raw HTML, images, tables, blockquotes, or arbitrary Markdown extensions.
- Building a full rich-text editor or live WYSIWYG authoring experience.
- Changing branching, validation, submission storage, or response export behavior.

## Decisions

### 1. Use a shared Markdown rendering utility for authored content only
A single shared renderer should be introduced for author-written text fields that are intended for display content, specifically question descriptions and text block bodies. This avoids duplicating parsing and styling rules across the public runner and creator review screens.

**Why:** Consistency and security are easier to maintain when all authored Markdown goes through one rendering path.

**Alternatives considered:**
- Render Markdown separately in each surface: rejected because it risks inconsistent formatting and repeated sanitization logic.
- Store pre-rendered HTML in the database: rejected because it complicates sanitization, migrations, and future rendering changes.

### 2. Support only a small, explicit Markdown subset
The renderer should support emphasis, strong text, inline code, links, unordered/ordered lists, and heading-like sections. Raw HTML must remain disabled.

**Why:** This matches the requested use cases while keeping author expectations narrow and reducing the chance of broken or surprising rendering.

**Alternatives considered:**
- Full CommonMark support: rejected because it adds complexity and exposes formatting behaviors the product is not prepared to style or validate well.
- A smaller subset without lists/headings: rejected because basic structure is part of the requested value.

### 3. Prefer a safe parser-based implementation over ad hoc regex replacement
Implementation should use a Markdown parser that can disable raw HTML and map only approved elements into styled React output, or an equivalent constrained renderer with the same guarantees.

**Why:** Lists, nested emphasis, and links are error-prone to parse safely with regex-based replacements. A parser-based approach is more predictable and easier to test.

**Alternatives considered:**
- Hand-rolled regex conversion: rejected because it is fragile for overlapping syntax and introduces security and maintenance risks.
- Allow raw HTML and sanitize afterward: rejected because the feature does not need HTML and disabling it entirely is safer.

### 4. Keep authored content editable as plain text in existing inputs
Creators should continue typing Markdown into the existing description/body fields; this change should not require a new editor control or a storage format change. Small helper copy can document the supported syntax.

**Why:** The feature is about display capability, not editing workflow redesign.

**Alternatives considered:**
- Introduce a dedicated Markdown editor or preview panel: rejected for now because it increases scope and UI complexity.

### 5. Leave respondent answers as plain text in review surfaces
Submitted short-text and long-text answers should continue to render with plain-text semantics, even when they contain Markdown-like syntax.

**Why:** This matches the requested scope, avoids ambiguity about author intent versus respondent input, and prevents creators from accidentally treating respondent text as formatted content.

**Alternatives considered:**
- Render free-form answers as Markdown too: rejected for this change because it expands scope and changes the semantics of stored answers.

## Risks / Trade-offs

- **Risk:** Different surfaces could style the same Markdown differently. → **Mitigation:** Use one shared renderer component or utility with shared element mappings.
- **Risk:** Authors may expect unsupported Markdown features to work. → **Mitigation:** Document the supported subset in builder help text and keep unsupported syntax visible as plain text rather than failing silently.
- **Risk:** Links could be abused with unsafe protocols. → **Mitigation:** Permit only safe `http` and `https` URLs and render invalid links as plain text.
- **Risk:** Heading support could visually overpower current layouts. → **Mitigation:** Map section-style headings to restrained typography that fits existing runner and review surfaces.
- **Risk:** A new dependency could add bundle size. → **Mitigation:** Keep the implementation narrowly scoped and reuse it only where authored Markdown is needed.

## Migration Plan

- No data migration is required because authored content remains stored in the existing string fields.
- Deploy the shared renderer and update the relevant UI surfaces to use it.
- Add or update tests covering supported syntax, unsupported syntax, and link safety.
- If rollback is needed, switch the affected surfaces back to plain text rendering; stored content remains compatible.

## Open Questions

- Whether builder inputs should include inline helper text only or also a lightweight preview in a later change.
- Whether section-style headings should support only one or two heading levels for tighter visual consistency.
