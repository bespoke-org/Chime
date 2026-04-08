## Context

The repository currently contains only a starter Bun TypeScript app, so this change establishes both the initial product direction and the first real application architecture. The target product is a Typeform-inspired v0 with a polished linear runner, a simple authenticated creator experience, and anonymous public submissions. The main constraints are keeping scope intentionally narrow, shipping a credible end-to-end slice quickly, and preserving a clean foundation for later additions such as branching, richer block types, and theming.

## Goals / Non-Goals

**Goals:**
- Deliver an authenticated creator app for owning, editing, publishing, and reviewing forms.
- Deliver a public anonymous runner that presents one block per screen in a strictly linear flow.
- Support exactly five v0 block types: text, short text, long text, single choice, and multiple choice.
- Keep the builder implementation simple with a left-hand ordered block list and a right-hand settings editor.
- Store responses reliably without coupling submissions to user authentication.
- Establish a production-ready web stack that supports rapid iteration on product UX.

**Non-Goals:**
- Branching logic, conditional steps, or dynamic next-step computation.
- Collaboration, workspaces, or multi-editor ownership.
- Deep analytics, charts, exports beyond basic response review, or integrations.
- Respondent accounts, login-gated submissions, or identity-linked response history.
- Full Typeform feature parity, advanced theming, embeds, uploads, or templates.

## Decisions

### 1. Use Next.js App Router as the application shell
The project will move from the Bun starter entrypoint to a Next.js App Router application. This gives one framework for authenticated creator routes, public runner routes, server-rendered pages, route handlers, and server actions.

**Why this decision:**
- The product needs both an authenticated app surface and public shareable pages.
- App Router supports colocated UI and server logic with good TypeScript ergonomics.
- It keeps deployment and routing simple for an app-shaped product.

**Alternatives considered:**
- Keep Bun-only server code: too low-level for the product UX we need.
- Split frontend and backend: cleaner separation, but unnecessary overhead for v0.

### 2. Use Auth.js only for creator authentication
Authentication will exist only in creator-facing routes such as dashboard, form editing, publishing, and response review. Public form pages and submission endpoints will not require login, and submission data will not use or save creator credentials.

**Why this decision:**
- Matches the product requirement for anonymous public submissions.
- Keeps the respondent experience frictionless.
- Minimizes privacy surface area in the initial release.

**Alternatives considered:**
- Require respondent login: directly conflicts with product goals.
- Support optional respondent auth from the start: adds complexity without v0 value.

### 3. Use Prisma with PostgreSQL for persistence
The data layer will use PostgreSQL with Prisma models for users, forms, blocks, and responses.

**Why this decision:**
- Strong fit for an authenticated multi-user web app.
- Clear schema evolution path as forms grow in complexity.
- Good integration with Next.js and Auth.js.

**Alternatives considered:**
- SQLite: acceptable for prototypes, but weaker for a hosted multi-user product foundation.
- Pure JSON/file storage: too fragile for ownership, publishing, and response querying.

### 4. Model forms as ordered blocks, not only questions
Each form will contain an ordered list of blocks with stable IDs. Block types are `text`, `short_text`, `long_text`, `single_choice`, and `multiple_choice`. Text blocks are part of the runner flow but do not collect answers.

**Why this decision:**
- Matches the conversational runner requirement better than a question-only model.
- Makes content-only screens first-class without special-case hacks.
- Creates a clean path for later screen-like blocks such as welcome or thank-you variants.

**Alternatives considered:**
- Question-only model with separate metadata screens: less expressive and harder to extend.

### 5. Store type-specific block settings in structured JSON on each block
Shared block fields will include identity, order, title, description, and required state. Type-specific details such as placeholders and option lists will live in a JSON config field.

**Why this decision:**
- Keeps the schema simple while block types are still evolving.
- Avoids premature normalization of highly variable block settings.
- Makes it easy to add more block types later without invasive migrations.

**Alternatives considered:**
- Separate columns per block type: rigid and noisy for a narrow v0.
- Separate tables per block type: over-modeled too early.

### 6. Store submitted answers as JSON keyed by block ID
Responses will be anonymous records containing timestamps and an `answersJson` payload keyed by block ID. Question blocks will map to string or string-array values depending on block type; text blocks will have no answer entry.

**Why this decision:**
- Fits the small fixed set of v0 block types.
- Supports response rendering without complex joins or polymorphic answer tables.
- Preserves flexibility while the product shape is still stabilizing.

**Alternatives considered:**
- Fully normalized answer tables: more queryable, but adds complexity before it is needed.

### 7. Builder UX will use a master-detail layout
The builder will use a left panel for ordered block management and a right panel for editing the selected block’s settings. Reordering will use dnd-kit. The builder is optimized for correctness and speed over maximal visual editing.

**Why this decision:**
- Chosen explicitly to keep v0 simpler and more reliable.
- Reduces state-management complexity compared with inline canvas editing.
- Works well with a narrow set of block types.

**Alternatives considered:**
- Canvas-first inline editing: more visually rich, but significantly higher implementation complexity.

### 8. Runner UX will prioritize one-block focus with motion and simple validation
The public form runner will render exactly one block at a time with next/back navigation, a progress indicator, lightweight transitions, and per-step required validation. Progress will count all blocks in the flow, including text blocks, to preserve a predictable step count.

**Why this decision:**
- Produces the intended Typeform-like feel.
- Keeps the flow model straightforward because all steps are linear and visible.
- Avoids confusion caused by hidden non-question screens.

**Alternatives considered:**
- Render only answerable blocks in progress: slightly more compact, but less faithful to the actual flow.

### 9. Allow form editing after responses exist while keeping block IDs stable
Creators may continue editing forms after responses have been collected. Block IDs must remain stable so existing responses can still be mapped back to the block structure they were submitted against.

**Why this decision:**
- Supports a practical creator workflow without requiring full versioning in v0.
- Minimizes data loss risk while keeping implementation scope contained.

**Alternatives considered:**
- Lock forms after first response: too restrictive for real usage.
- Full form versioning: valuable later, but too heavy for v0.

## Risks / Trade-offs

- **Editing forms after responses may create mismatches with historic answers** → Keep stable block IDs and present response data defensively using stored labels/config where needed in later iterations.
- **JSON-based block config and answers trade queryability for speed** → Accept this for v0 and revisit normalization when analytics or filtering requirements appear.
- **Next.js migration replaces the current starter shape completely** → Treat the current repo as scaffolding only and build the new app structure deliberately from scratch.
- **Anonymous public submissions can invite spam or abuse** → Keep the initial submission surface minimal and add rate limiting or bot protection later if real usage demands it.
- **Polished runner interactions can consume disproportionate frontend time** → Limit v0 motion to a few high-value transitions and keep the builder intentionally plain.

## Migration Plan

1. Replace the Bun starter entrypoint with a Next.js application structure.
2. Add dependencies for Tailwind, shadcn/ui, Framer Motion, dnd-kit, Prisma, PostgreSQL, and Auth.js.
3. Introduce Prisma schema and initial migrations for users, forms, blocks, and responses.
4. Build creator authentication and protected app routes.
5. Build the dashboard, builder, publish flow, public runner, and response review pages.
6. Validate end-to-end flows locally with draft and published forms.

Rollback is straightforward at this stage because there is no existing production system or user data to preserve.

## Open Questions

- Which Auth.js provider strategy should be used first for creator sign-in: credentials, OAuth, or both?
- Should v0 include draft autosave in the builder, or are explicit saves sufficient for the first cut?
- Should response metadata include IP/user-agent fields for abuse investigation, or should v0 avoid storing them entirely?
