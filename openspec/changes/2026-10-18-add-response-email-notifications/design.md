## Context

A response is created in `createAnonymousResponse`, where the form record, the normalized answers, and the snapshot of visited blocks are already in hand; the webhook is fired from there without being awaited. Profile settings already flow through `profileSettingsSchema`, `updateProfileSettings`, and the profile panel, and form settings through `formMetadataSchema`, `toBuilderForm`, and the settings panel. Users sign in with ATProto only, so `User.email` from the auth adapter is normally empty and cannot serve as the recipient. The app runs as a single Node process without a job queue.

## Goals / Non-Goals

**Goals:**
- Let a creator receive an email for each stored response on forms where they ask for it.
- Keep storing the response and answering the respondent independent of SMTP availability.
- Keep message building pure and the sending step swappable so the flow is testable without SMTP or a database.
- Keep addresses and message content out of the server log.

**Non-Goals:**
- Notifying organization members other than the form owner.
- Email verification, bounce handling, digests, or a retry queue.
- Attaching exports or rendering a styled HTML template.
- Using the notification email for sign-in or any other purpose.

## Decisions

### 1. A separate `notificationEmail` column on `User`
The recipient address is stored in `User.notificationEmail`, nullable, next to the adapter's `email`, which is left untouched. The address is trimmed, lowercased, checked with zod's email rule, and limited to 254 characters; an empty value clears it.

**Why:** The adapter owns `email` and its unique index; writing a creator-entered address there would mix an identity field with a preference and could collide between accounts.

**Alternatives considered:**
- Reusing `User.email`: rejected for the reasons above.
- A notification settings table: rejected while there is one address and one switch.

### 2. A boolean `notifyOnResponse` on `Form`, owner only
Each form carries `notifyOnResponse`, default `false`, edited and saved with the other settings. The recipient is always the form owner (`Form.userId`), also for forms in an organization workspace. The builder shows whether the owner has an address through `ownerHasNotificationEmail` on `BuilderForm` and links to profile settings when they do not.

**Why:** The form owner is the one account the form always has. Per-member subscriptions need their own data model and UI and are left for later.

**Alternatives considered:**
- Notifying every organization member: rejected; most members did not ask for the mail and there is no way to opt out yet.
- Storing a recipient address per form: rejected; a profile-level address is set once and changes in one place.

### 3. Mailer as a thin module over nodemailer
`lib/mailer.ts` reads `MAIL_FROM` and either `SMTP_URL` or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` in a pure `getMailerConfig(env)`. `SMTP_URL` wins when both are set; a missing or non-numeric port falls back to 465 when secure and 587 otherwise. The transport is created lazily once. `sendMail` never throws, returns `{ ok, error? }`, logs only the recipient's domain on failure, and warns once per process when nothing is configured.

**Why:** nodemailer is the standard SMTP client for Node and accepts both a URL and an options object, so operators can use whichever form their provider documents. A single warning avoids one log line per response on installations that never set up SMTP.

**Alternatives considered:**
- A provider HTTP API: rejected; SMTP works with any provider and self-hosted servers.
- Failing form submission when SMTP is down: rejected; the respondent's answer must not depend on it.

### 4. Message built from the submission snapshot with export serialization
`buildResponseNotificationEmail` is pure. It walks the visited blocks, keeps question blocks, and prints each title (or "Question N" when untitled) with the answer serialized by `serializeExportAnswer`, so arrays are joined with " | " and agreement answers read as in exports. The plain text version stands on its own; the HTML version escapes titles, answers, and the link. The language comes from the owner's `locale`, normalized with the existing i18n helpers; the link base comes from `NEXTAUTH_URL`, with `ATPROTO_PUBLIC_URL` as fallback.

**Why:** The snapshot is already the record of what the respondent saw, in order, and exports already define how values read as text. Escaping is required because both titles and answers are user-controlled.

**Alternatives considered:**
- Sending the raw answer map: rejected, unreadable for a person.
- Rendering through the YAML locale files: rejected; the copy is a handful of strings and the mailer must not depend on request context.

### 5. Fire-and-forget from `createAnonymousResponse`, swappable mailer
`notifyOwnerOfResponse` is called with `void` right after `db.response.create`, next to the webhook. It returns early when the form has the switch off, when the mailer is not configured (before any database read), or when the owner has no address; otherwise it loads `notificationEmail` and `locale` with one `findUnique` and sends. It catches everything and warns with the form id only. Tests replace the mailer with `setResponseNotificationMailer`, the same shape as `setWebhookDeliverer`.

**Why:** The pattern already exists for webhooks and keeps the HTTP answer independent of SMTP latency and failures.

## Risks / Trade-offs

- [A slow SMTP server holds a connection per response] → Mitigation: nodemailer's default connection timeouts apply and the send is not awaited by the request.
- [Creators may expect members of an organization to be notified] → Mitigation: the help text names the form owner's profile email; member notifications are a separate change.
- [A mistyped address silently drops mail] → Mitigation: the address is validated on save; bounce handling is out of scope.
- [Process restarts lose in-flight sends] → Accepted; there is no queue, as with webhooks.

## Migration Plan

- Add `User.notificationEmail` (nullable) and `Form.notifyOnResponse` (default `false`) with one migration.
- Thread both fields through validation, serialization, and the two settings panels.
- Add the mailer and notification modules and call the notifier after the response insert.
- Rollback is low risk: without SMTP variables nothing is sent, and the code can ignore both columns.

## Open Questions

- None. Owner-only delivery and the environment variable names were agreed before implementation.
