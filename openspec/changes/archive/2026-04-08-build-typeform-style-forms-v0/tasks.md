## 1. Project foundation

- [x] 1.1 Replace the Bun starter app with a Next.js App Router project structure and baseline app shell
- [x] 1.2 Add and configure the core dependencies: Tailwind CSS, shadcn/ui, Framer Motion, dnd-kit, Prisma, PostgreSQL, and Auth.js
- [x] 1.3 Set up shared application utilities for database access, auth configuration, and route protection

## 2. Data model and persistence

- [x] 2.1 Define Prisma models and migrations for users, forms, form blocks, and anonymous responses
- [x] 2.2 Implement server-side data access for creating, updating, ordering, publishing, and loading owned forms
- [x] 2.3 Implement server-side response persistence for anonymous submissions and creator-side response retrieval

## 3. Creator authentication and ownership

- [x] 3.1 Implement creator sign-in and session handling with Auth.js
- [x] 3.2 Protect creator-only routes and redirect unauthenticated users to sign in
- [x] 3.3 Enforce form ownership checks for editing, publishing, and response review actions

## 4. Creator dashboard and builder

- [x] 4.1 Build the creator dashboard for listing owned forms and creating a new draft form
- [x] 4.2 Build the form builder master-detail layout with a block list and selected-block editor panel
- [x] 4.3 Implement block creation, selection, editing, deletion, and drag-and-drop reordering for the five v0 block types
- [x] 4.4 Implement form metadata editing plus publish/unpublish and share-link controls

## 5. Public conversational runner

- [x] 5.1 Build the public published-form route and reject draft or unpublished forms from public response collection
- [x] 5.2 Implement the one-block-at-a-time runner with next/back navigation, progress display, and motion transitions
- [x] 5.3 Implement block-specific inputs and required validation for short text, long text, single choice, and multiple choice blocks
- [x] 5.4 Implement anonymous submission and completion state for the final runner step

## 6. Response review

- [x] 6.1 Build the creator responses list view for an owned form
- [x] 6.2 Build the single-response detail view with answers shown in form order
- [x] 6.3 Ensure text blocks are handled correctly in response presentation while preserving flow context

## 7. Integration polish

- [x] 7.1 Connect end-to-end flows across dashboard, builder, publishing, public runner, and response review
- [x] 7.2 Add basic empty, loading, and error states for key creator and respondent surfaces
- [x] 7.3 Validate the v0 experience manually for anonymous submissions, ownership enforcement, and linear runner behavior
