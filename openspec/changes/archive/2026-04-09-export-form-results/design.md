## Context

Lively Forms already stores anonymous responses and gives creators an authenticated response review surface, but that data currently stays inside the product. Exporting responses is a cross-cutting addition because it touches creator UI, ownership checks, response shaping, and file generation for multiple output formats.

The current codebase already has server-side form ownership checks and response retrieval in `lib/forms.ts` plus creator-facing response pages under `app/(creator)/forms/[id]/responses/`. The new export flow should fit that model: exports are generated on the server for owned forms only and downloaded from the creator surface.

## Goals / Non-Goals

**Goals:**
- Let creators export responses for forms they own.
- Support two practical spreadsheet-oriented formats in the first release: CSV and XLSX.
- Produce stable, readable exports that include submission metadata and one column per answerable block.
- Keep export authorization aligned with existing response review ownership rules.
- Avoid database schema changes.

**Non-Goals:**
- Building a generic reporting system or analytics dashboard.
- Supporting every possible format in v1 (PDF, JSON, XML, etc.).
- Exporting per-question aggregates or charts.
- Persisting generated export files for later retrieval.

## Decisions

### 1. Add export actions to the creator responses surface
The responses list page is the most natural place to export because it already represents the form-level response dataset. This keeps export discoverable and avoids duplicating controls elsewhere.

**Alternatives considered:**
- Add export actions in the form builder only: rejected because exports belong to response data, not structure editing.
- Add export on each single-response page: rejected because the goal is dataset export, not one-off answer download.

### 2. Generate exports on the server per request
CSV/XLSX generation should happen in a server route or equivalent server-only handler after ownership verification. This avoids exposing raw response shaping logic to the client and keeps sensitive data authorization centralized.

**Alternatives considered:**
- Client-side export from already rendered response data: rejected because the full dataset may not be loaded and authorization should remain server-enforced.
- Background job + stored files: rejected as unnecessary complexity for an on-demand export feature.

### 3. Scope v1 formats to CSV and XLSX
CSV gives a universal, low-dependency format for imports and scripts. XLSX covers common spreadsheet workflows and preserves a cleaner multi-column experience for non-technical creators.

**Alternatives considered:**
- CSV only: simpler, but does not satisfy spreadsheet-first users who expect native Excel-compatible downloads.
- Add JSON in v1: useful for integrations, but weaker product fit than spreadsheet exports for the current audience.
- Add PDF in v1: poor fit for tabular response datasets.

### 4. Shape exports as one row per submission with derived columns
Each exported row should represent one submission. Columns should begin with submission metadata (submission number, submitted timestamp, response ID) followed by one column per answerable block in saved form order. Column labels should use the block prompt when present, with a deterministic fallback for untitled questions.

This mirrors how creators think about submissions and makes the data immediately usable in spreadsheets.

**Alternatives considered:**
- One sheet/tab per question: rejected because it complicates analysis and breaks the simple spreadsheet mental model.
- Raw JSON blobs per submission: rejected because it reduces usability in CSV/XLSX.

### 5. Serialize complex answers into readable cells
Short and long text answers export as plain text. Single choice exports as the selected option. Multiple choice exports as a delimited string in a single cell for both CSV and XLSX so both formats share the same conceptual schema.

**Alternatives considered:**
- Expand multiple choice into one boolean column per option: powerful, but couples exports to mutable option sets and increases column sprawl in v1.
- Store arrays in XLSX but flatten only CSV: rejected because differing schemas by format would be harder to explain and test.

### 6. Reuse existing response/domain mapping helpers where possible
The implementation should centralize export row construction in shared server-side helpers so CSV and XLSX use the same data shaping logic. Format writers should consume the same normalized export dataset.

**Alternatives considered:**
- Separate CSV/XLSX shaping paths: rejected because it invites drift and duplication.

## Risks / Trade-offs

- **Wide forms can produce wide exports** → Use saved block order and straightforward headings; accept width as a natural consequence of flexible forms.
- **Untitled or duplicate question prompts can create confusing columns** → Provide deterministic fallback labels and preserve order so columns remain understandable.
- **CSV formatting can be lossy for multiline text or separators** → Use a proper CSV serializer/escaping strategy rather than hand-built strings.
- **New XLSX dependency increases bundle and maintenance surface** → Keep workbook generation server-only and use a minimal, well-supported library.
- **Large response sets may increase request time** → Start with on-demand synchronous exports and monitor; optimize later if volume warrants it.

## Migration Plan

- No database migration is required.
- Ship the server export handler and creator UI together so the control is only visible when the backend exists.
- If rollback is needed, remove or disable the export action while leaving response review unaffected.

## Open Questions

- Whether the exported timestamp should use UTC ISO strings or a more human-readable format. Initial recommendation: use a stable machine-friendly timestamp value.
- Exact filename convention. Initial recommendation: include form slug and format, e.g. `<slug>-responses.csv` and `<slug>-responses.xlsx`.
