<h1 align="center">Chime</h1>

Chime is a self-hosted form builder in the style of Typeform: the respondent sees one question at a time, the creator builds the form from blocks, adds branching, publishes it at a public link and reviews or exports the responses. It is a single Next.js app on PostgreSQL with optional S3-compatible storage for file uploads, released under the AGPL.

<!-- screenshot: builder with the block list and the settings panel -->
<!-- screenshot: public runner with one question on screen -->
<!-- screenshot: responses page with the funnel and the export menu -->

## Features

- Builder with eleven block types: text, short text, long text, single choice, multiple choice, number, link, agreement, date, rating and file upload; blocks are reordered by drag and drop and titles and descriptions accept basic Markdown.
- Conditional branching between blocks, validated in the builder and shown as a graph; submissions follow the branch the respondent took.
- Public runner with keyboard controls, saved progress in the browser and a form-level locale override; respondents do not sign in.
- Form closing by date, by response limit or by a switch; closed forms show a message and answer `410` to submissions.
- Responses page with per-question views, a visit funnel and CSV and XLSX export; identity fields chosen in the builder label each response.
- Webhooks per form or per workspace: one request per response or a digest per hour, day or week, signed with HMAC-SHA256, with hosts checked against private address ranges before every delivery.
- Email notifications to subscribed creators over SMTP.
- Personal and shared workspaces (organizations) with invite links.
- Sign-in with ATProto (Bluesky and other PDS accounts), Google, GitHub or any OpenID Connect provider; an optional allowlist of emails, DIDs and domains restricts who may sign in.
- Rate limits and a minimum fill time on public submissions and upload requests.
- English and Russian interface, light and dark theme.

## Self-hosting

The stack runs from `compose.prod.yaml`: the app image built by the `Dockerfile`, PostgreSQL 16, [Garage](https://garagehq.deuxfleurs.fr) for file uploads and a one-shot migration. A reverse proxy with HTTPS in front of it is expected.

```bash
git clone https://github.com/bespoke-org/Chime.git
cd Chime
cp .env.example .env
# set AUTH_SECRET, NEXTAUTH_URL, ATPROTO_PUBLIC_URL, ATPROTO_CLIENT_ID, ATPROTO_REDIRECT_URI,
# POSTGRES_PASSWORD, GARAGE_RPC_SECRET and GARAGE_ADMIN_TOKEN in .env
docker compose -f compose.prod.yaml up -d --build
```

The app listens on `127.0.0.1:3000`. The step-by-step guide, the file upload setup and the reverse proxy notes are in [docs/deployment.md](docs/deployment.md). The same document describes `scripts/deploy.sh`, the author's ssh and podman-compose setup.

## Configuration

All settings are environment variables, listed with comments in [.env.example](.env.example).

Deployment-specific authentication, access policy, provider icons, mail and storage are configured outside the source tree. See [Deployment customization](docs/customization.md) for the available settings and when a fork is needed. Before upgrading an existing installation, follow [Upgrading to Chime](docs/deployment.md#upgrading-to-chime).

| Variable                                                                                                                 | Required                         | Purpose                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                                                                           | yes (set by `compose.prod.yaml`) | PostgreSQL connection string                                                               |
| `AUTH_SECRET`                                                                                                            | yes                              | Session secret for Auth.js                                                                 |
| `NEXTAUTH_URL`, `ATPROTO_PUBLIC_URL`                                                                                     | yes                              | Public origin of the app                                                                   |
| `ATPROTO_CLIENT_ID`, `ATPROTO_REDIRECT_URI`, `ATPROTO_CLIENT_NAME`, `ATPROTO_SCOPE`                                      | yes (scope optional)             | ATProto OAuth client metadata                                                              |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                               | no                               | Google sign-in                                                                             |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                                                                               | no                               | GitHub sign-in                                                                             |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_PROVIDER_NAME`, `OIDC_PROVIDER_ICON_URL`, `OIDC_SCOPE`      | no                               | OpenID Connect sign-in; name and icon URL (a monochrome SVG) label the button              |
| `ALLOWED_SIGNIN_IDENTIFIERS`                                                                                             | no                               | Comma-separated emails, DIDs and domains allowed to sign in; empty means open registration |
| `TRUSTED_PROXY_HOPS`                                                                                                     | no                               | Reverse proxies in front of the app that append to `X-Forwarded-For` (default 1)           |
| `SUBMISSION_RATE_LIMIT`, `SUBMISSION_GLOBAL_RATE_LIMIT`, `SUBMISSION_RATE_WINDOW_SECONDS`, `SUBMISSION_MIN_FILL_SECONDS` | no                               | Public submission limits                                                                   |
| `DIGEST_TIMEZONE`                                                                                                        | no                               | IANA zone for digest webhook schedules (default `UTC`)                                     |
| `MAIL_FROM`, `SMTP_URL` or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`                         | no                               | Email notifications                                                                        |
| `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                | no                               | File uploads; `S3_PUBLIC_ENDPOINT` is required in production when uploads are on           |
| `UPLOAD_MAX_SIZE_MB`, `UPLOAD_RATE_LIMIT`, `UPLOAD_RATE_WINDOW_SECONDS`                                                  | no                               | Upload limits                                                                              |
| `POSTGRES_PASSWORD`, `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`                                                           | compose only                     | Secrets of the Postgres and Garage containers                                              |

## How it compares

- [Typeform](https://www.typeform.com) is the hosted, subscription service this project takes its one-question-at-a-time format from; its plans meter responses per month and it is not self-hostable. Chime has no plans or limits beyond your server and no hosted offering.
- [Formbricks](https://github.com/formbricks/formbricks) is an open source (AGPL core, separately licensed enterprise folder) experience management platform with in-app, website, link and email surveys and a Docker self-hosting path. Chime covers link forms only, has no SDK for embedding in your own app and no enterprise edition.
- Compared with both, Chime is small: one process, a PostgreSQL database and an S3 bucket, with ATProto sign-in and workspaces; rate limits and the digest scheduler are per app instance, so it runs as a single instance.

## Development

```bash
bun install
bun run hooks:install
cp .env.example .env
bun run db:up
bun run prisma:migrate
bun run storage:init
bun run dev
```

Open `http://127.0.0.1:3000`. `bun run check` runs formatting, unit tests, lint, type check and the production build; the pre-commit hook and GitHub Actions (`.github/workflows/ci.yml`) run the same. See [docs/development.md](docs/development.md).

## Credits

Chime is written by Michael Chernigin and Nikita Rydanov.

## License

Licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`).
See [LICENSE](./LICENSE).

Copyright (C) 2026 Michael Chernigin
