# Lively Forms

Lively Forms is a conversational form builder inspired by Typeform. It lets creators build multi-step forms, publish them publicly, collect anonymous responses, and review/export submissions across personal or shared organization workspaces.

## Features

### Form building
- Master-detail form builder with block reordering
- Supported block types:
  - text
  - short text
  - long text
  - single choice
  - multiple choice
  - number
  - link
  - agreement
  - date
- Required questions
- Type-specific validation:
  - text regex validation
  - number min/max and integer-only rules
  - link validation
  - date validation
  - agreement validation
- Publish / unpublish controls
- Shareable public form slugs
- Custom completion title, message, and optional follow-up link

### Branching and flow logic
- Forward-only branching between later blocks
- Default next target when no branch rule matches
- Operator-based conditions by block type:
  - equals / not equals
  - is empty / is not empty
  - contains
  - contains any
  - greater / greater-or-equal / less / less-or-equal
- Builder-side branching validation with publish blockers and advisory warnings
- Branch-aware public runner with visited-path navigation and recalculated progress
- Submission validation only for blocks actually visited in the chosen route

### Responses
- Anonymous public submissions
- Response list and response detail views
- Branched response review with visited and skipped route context
- CSV and XLSX response export

### Workspaces and collaboration
- Personal workspace
- Organization workspaces
- Organization owner administration
- Invite links for joining organizations
- Shared form management inside organizations

### Creator experience
- Google sign-in for creators
- Dashboard grid and table views with sorting
- Profile settings for name, avatar, and locale
- Light / dark / system theme preference
- Localized UI in English and Russian

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Auth.js (`next-auth`) with Google OAuth
- Prisma + PostgreSQL
- dnd-kit
- Framer Motion
- Bun for package management
- Podman Compose for local Postgres

## Quick start

```bash
bun install
cp .env.example .env
bun run db:up
bun run prisma:migrate
bun run dev
```

Open `http://localhost:3000`.

You must also configure Google OAuth for local development. See [docs/deployment.md](docs/deployment.md).

## Useful commands

```bash
bun run dev
bun run build
bun run lint
bun run db:up
bun run db:down
bun run db:logs
bun run db:reset
bun run prisma:generate
bun run prisma:migrate
bun run prisma:studio
```

## Docs

- [Development](docs/development.md)
- [Deployment and environment setup](docs/deployment.md)

## Notes

- Creator authentication is only required for building, publishing, and reviewing forms.
- Public respondents do not sign in.
- Responses are stored anonymously.
- Editing a published form updates the live form immediately.
