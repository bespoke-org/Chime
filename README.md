<h1 align="center">
  <img src="public/sproute.png" alt="Lively Forms icon" width="64" height="64" align="center">
  Lively Forms
</h1>

Lively Forms is a conversational form builder inspired by Typeform. It lets creators build multi-step forms, publish them publicly, collect anonymous responses, and review/export submissions across personal or shared organization workspaces.

## Features

- Conversational multi-step form builder with reordering and polished public runner
- Rich block set for text, choices, numbers, links, agreements, and dates
- Conditional branching with builder-side validation and branch-aware submissions
- Anonymous response collection with detailed review and CSV/XLSX export
- Personal and organization workspaces with shared form management
- Creator-focused experience with ATProto/PDS sign-in, localization, and theme settings

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Auth.js (`next-auth`) sessions with ATProto OAuth
- Prisma + PostgreSQL
- S3-compatible object storage for file uploads (Garage in local development)
- nodemailer for SMTP email notifications
- dnd-kit
- Framer Motion
- Bun for package management
- Podman Compose or Docker Compose for local Postgres and Garage

## Quick start

```bash
bun install
bun run hooks:install
cp .env.example .env
bun run db:up
bun run prisma:migrate
bun run dev
```

Open `http://127.0.0.1:3000`.

You must also configure ATProto OAuth/client metadata for local development. See [docs/deployment.md](docs/deployment.md).

## Useful commands

```bash
bun run dev
bun run build
bun run lint
bun run check
bun run hooks:install
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

## License

Licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`).
See [LICENSE](./LICENSE).

Copyright (C) 2026 Michael Chernigin
