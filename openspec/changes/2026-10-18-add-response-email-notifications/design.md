## Context

A response is created in `createAnonymousResponse`, where the form record, the normalized answers, and the snapshot of visited blocks are already in hand; the webhook is fired from there without being awaited. Profile settings already flow through `profileSettingsSchema`, `updateProfileSettings`, and the profile panel, and form settings through `formMetadataSchema`, `toBuilderForm`, and the settings panel. Form access for members of an organization is expressed by `workspaceAccessWhere`. Users sign in with ATProto only, so `User.email` from the auth adapter is normally empty and cannot serve as the recipient. The app runs as a single Node process without a job queue.

## Goals / Non-Goals

**Goals:**
- Let every member who can open a form receive an email for each stored response on forms where they ask for it.
- Keep storing the response and answering the respondent independent of SMTP availability.
- Keep message building pure and the sending step swappable so the flow is testable without SMTP or a database.
- Keep addresses and message content out of the server log.

**Non-Goals:**
- Email verification, bounce handling, digests, or a retry queue.
- Attaching exports or rendering a styled HTML template.
- Using the notification email for sign-in or any other purpose.

## Decisions

### 1. A separate `notificationEmail` column on `User`
The recipient address is stored in `User.notificationEmail`, nullable, next to the adapter's `email`, which is left untouched. The address is trimmed, lowercased, checked with zod's email rule, and limited to 254 characters; an empty value clears it.

**Why:** The adapter owns `email` and its unique index; writing a creator-entered address there would mix an identity field with a preference and could collide between accounts.

**Alternatives considered:**
- Reusing `User.email`: rejected for the reasons above.
- A notification settings table: rejected while there is one address per user.

### 2. A `FormNotificationSubscription` row per member and form
A subscription is a row `(formId, userId)` in `FormNotificationSubscription`, cascading from both `Form` and `User`. A user may subscribe to any form they can open in the builder, checked with `workspaceAccessWhere`. The switch is saved by `PUT /api/forms/[formId]/notifications` with `{ enabled }` the moment it is toggled, not with the form settings form, since it is the viewer's own preference and not a property of the form. `BuilderForm` carries `notificationsEnabled` (the viewer's subscription) and `viewerHasNotificationEmail`, and the panel links to profile settings when the viewer has no address. Removing a member from an organization deletes their subscriptions on that organization's forms in the same transaction as the membership; organization and form deletion cascade.

**Why:** In an organization several people look after one form, and each of them should decide for themselves whether they want the mail. A flag on the form cannot say who.

**Alternatives considered:**
- A boolean on `Form` with the owner as the only recipient: that was the first version; it left organization members without a way to be notified.
- Notifying every organization member: rejected; most members did not ask for the mail.
- Storing a recipient address per subscription: rejected; a profile-level address is set once and changes in one place.

### 3. Mailer as a thin module over nodemailer
`lib/mailer.ts` reads `MAIL_FROM` and either `SMTP_URL` or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` in a pure `getMailerConfig(env)`. `SMTP_URL` wins when both are set; a missing or non-numeric port falls back to 465 when secure and 587 otherwise. The transport is created lazily once. `sendMail` never throws, returns `{ ok, error? }`, logs only the recipient's domain on failure, and warns once per process when nothing is configured.

**Why:** nodemailer is the standard SMTP client for Node and accepts both a URL and an options object, so operators can use whichever form their provider documents. A single warning avoids one log line per response on installations that never set up SMTP.

**Alternatives considered:**
- A provider HTTP API: rejected; SMTP works with any provider and self-hosted servers.
- Failing form submission when SMTP is down: rejected; the respondent's answer must not depend on it.

### 4. Message built from the submission snapshot with export serialization
`buildResponseNotificationEmail` is pure. It walks the visited blocks, keeps question blocks, and prints each title (or "Question N" when untitled) with the answer serialized by `serializeExportAnswer`, so arrays are joined with " | " and agreement answers read as in exports. The plain text version stands on its own; the HTML version escapes titles, answers, and the link. The language comes from each recipient's `locale`, normalized with the existing i18n helpers; the link base comes from `NEXTAUTH_URL`, with `ATPROTO_PUBLIC_URL` as fallback.

**Why:** The snapshot is already the record of what the respondent saw, in order, and exports already define how values read as text. Escaping is required because both titles and answers are user-controlled.

**Alternatives considered:**
- Sending the raw answer map: rejected, unreadable for a person.
- Rendering through the YAML locale files: rejected; the copy is a handful of strings and the mailer must not depend on request context.

### 5. Fire-and-forget from `createAnonymousResponse`, swappable mailer
`notifyResponseSubscribers` is called with `void` right after `db.response.create`, next to the webhook. It returns early when the mailer is not configured (before any database read); otherwise it loads the subscribers that have an address with one query (`listNotificationRecipients`) and sends one email per recipient with `Promise.allSettled`, so one failure does not stop the others. It catches everything and warns with the form id and the recipient's domain only. Tests replace the mailer with `setResponseNotificationMailer`, the same shape as `setWebhookDeliverer`.

**Why:** The pattern already exists for webhooks and keeps the HTTP answer independent of SMTP latency and failures.

## Risks / Trade-offs

- [A slow SMTP server holds a connection per response] → Mitigation: nodemailer's default connection timeouts apply and the send is not awaited by the request.
- [Members may expect the owner's switch to cover them] → Mitigation: the help text says each member chooses for themselves.
- [A mistyped address silently drops mail] → Mitigation: the address is validated on save; bounce handling is out of scope.
- [Process restarts lose in-flight sends] → Accepted; there is no queue, as with webhooks.

## Migration Plan

- Add `User.notificationEmail` (nullable) with one migration; replace the earlier `Form.notifyOnResponse` with `FormNotificationSubscription` in a second one, without carrying data over (the product is unreleased).
- Thread the address through profile validation and the panel, and the subscription through `BuilderForm` and the form settings panel.
- Add the mailer and notification modules and call the notifier after the response insert.
- Rollback is low risk: without SMTP variables nothing is sent, and the code can ignore the table.

## Open Questions

- None. Per-member subscriptions and the environment variable names were agreed before implementation.
