## Context

The current response review experience is organized around individual submissions. Creators can open the responses page, inspect each submission, and drill into a single response, but they cannot review a form question as a unit or understand answer patterns without manually scanning many submissions.

This project already stores enough data to support question-centric review. Each saved response includes `answersJson` plus a snapshot of the visited blocks for that submission, which means the system can distinguish between blocks that were visited, blocks skipped by branching, and blocks left unanswered while still preserving form-order context.

## Goals / Non-Goals

**Goals:**
- Add a second responses-page mode for reviewing answers by question instead of only by submission.
- Preserve the existing response list as the default mode so current workflows do not break.
- Show lightweight aggregate stats for each answerable block using data already stored with submissions.
- Respect branching so question-level summaries reflect only submissions that actually reached a given block.

**Non-Goals:**
- Replacing the single-response detail page.
- Building advanced analytics, charts, or cross-question reporting.
- Adding new database tables, background jobs, or external analytics dependencies.
- Changing export formats as part of this change.

## Decisions

### Decision: Keep both response-review modes on the existing responses page
The responses page will expose a view switcher with two modes: the current submission list and a new question-centric list. Submission view remains the default.

**Rationale:** This keeps response review in one place, avoids fragmenting navigation, and lets creators switch mental models without leaving the form context.

**Alternatives considered:**
- Separate question analytics page: rejected because it adds navigation overhead and duplicates page structure.
- Replacing the current list with question view: rejected because creators still need respondent-by-respondent inspection.

### Decision: Aggregate question summaries server-side from saved response data
Question-level summaries will be computed in server code from the form blocks, each response's `answersJson`, and each response's saved visited-block snapshot.

**Rationale:** The required data already exists, so server-side aggregation avoids schema changes and keeps branching semantics consistent with the saved submission route.

**Alternatives considered:**
- Client-side aggregation from raw response payloads: rejected because it would push too much data-shaping logic into the UI.
- Precomputed database aggregates: rejected because the data volume does not justify added write-time complexity yet.

### Decision: Scope question summaries to answerable blocks only
The question-centric view will exclude text-only blocks and summarize only blocks that can receive answers.

**Rationale:** Text blocks are context, not questions. Including them in the question list would add noise and weaken the usefulness of the view.

**Alternatives considered:**
- Showing all blocks including text sections: rejected because it makes question review harder to scan.

### Decision: Use type-specific lightweight summaries
Each question block type will expose a summary shape that fits the data:
- single choice / agreement: per-option counts
- multiple choice: per-option counts across submissions
- number: answered count plus min, max, and average
- short text / long text / link / date: answered count plus a list of submitted answers

Each summary will also track high-level participation counts such as reached, answered, and skipped-by-branching where possible.

**Rationale:** Creators want quick insight first, not full analytics infrastructure. Type-specific summaries provide immediate value while staying implementable within the existing response-review stack.

**Alternatives considered:**
- One generic summary format for every block: rejected because it would be too weak for numeric and choice questions.
- Full charts and advanced analytics: rejected as out of scope for this change.

## Risks / Trade-offs

- [Large text-answer volumes may make question view heavy] → Start with a simple list and keep the view server-rendered; add truncation or pagination later if real usage demands it.
- [Aggregating from saved response snapshots may increase page load cost on forms with many responses] → Keep the first version simple and use one aggregation pass over responses; revisit optimization only if performance becomes an issue.
- [Branching semantics can be confusing when a question was never reached] → Explicitly distinguish reached, answered, and skipped-by-branching counts in the summary model.
- [Different block types need different summary UI] → Centralize summary shaping in server-side helpers so rendering stays predictable and testable.

## Migration Plan

No database migration is required. Deploy as an additive UI and server-data change. If the new question view causes issues, fallback is straightforward: hide the view switcher and stop rendering the aggregated data path while keeping the existing submission review intact.

## Open Questions

- Should free-text style questions show the full answer list immediately or a limited preview with a “show more” affordance?
- Do we want the selected response-review mode to persist per user or form, or is per-page default state sufficient for the first release?
