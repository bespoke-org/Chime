## Why

This project currently has no product direction beyond a starter Bun app. We want to establish a focused, buildable v0 for a Typeform-inspired product that emphasizes a polished one-screen-at-a-time form experience instead of broad feature parity.

## What Changes

- Introduce authenticated creator accounts for owning and managing forms.
- Add a form builder for creating linear conversational forms with a simple sidebar-and-editor workflow.
- Support five v0 block types: text, short text, long text, single choice, and multiple choice.
- Add publish/unpublish and public shareable form links.
- Add a public form runner that collects anonymous responses without requiring respondent authentication.
- Add creator response views for listing and inspecting submitted responses.
- Establish the initial technical foundation with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, dnd-kit, Prisma, PostgreSQL, and Auth.js.

## Capabilities

### New Capabilities
- `creator-auth`: authenticate creators so they can create, edit, publish, and review only their own forms.
- `conversational-form-builder`: create and manage linear forms with ordered blocks, block editing, and publish/share controls.
- `anonymous-form-runner`: present published forms as one-block-at-a-time conversational flows and accept anonymous public submissions.
- `response-review`: let creators list and inspect responses submitted to forms they own.

### Modified Capabilities
- None.

## Impact

- Replaces the current starter-only direction with a real web product architecture.
- Introduces application routes for creator dashboards, form editing, public form access, and response review.
- Adds authentication, database models, form/block/response persistence, and public submission endpoints.
- Adds new frontend dependencies for app UI, motion, drag-and-drop, ORM, database access, and auth.
