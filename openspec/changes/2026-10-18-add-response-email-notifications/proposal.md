## Why

A creator learns about new responses only by opening the dashboard or by running their own webhook receiver. Many creators have no endpoint to receive a webhook and want the plain answer: an email when someone fills in the form. Sign-in is ATProto only and gives the app no email address, so the creator has to supply one.

## What Changes

- Add a notification email to profile settings, stored separately from the adapter's `email` field and used for nothing else.
- Add a per-member subscription "Email me about new responses" in form settings, off by default, saved on its own as soon as it is toggled.
- After a response is stored, send one email to every subscribed member who has a notification email, with the form title, the answers in form order, and a link to the response page, in each recipient's language.
- Point the creator at profile settings from the form settings panel when they have no notification email yet.
- Send through SMTP with `nodemailer`, configured by environment variables; without them the setting is saved but no email is sent.
- Keep response storage and the respondent's success answer independent of the email outcome, and keep addresses and message content out of the server log.

## Capabilities

### New Capabilities
- `response-notifications`: email every subscribed member about each stored response, without affecting the response.

### Modified Capabilities
- `creator-profile-settings`: add a notification email the creator can set, change, and clear.
- `conversational-form-builder`: add the per-member notification switch and the hint shown when the viewer has no notification email.

## Impact

- Affected code: Prisma `User` model and a new `FormNotificationSubscription` model with migrations, `profileSettingsSchema`, profile settings panel and action, builder form serialization and types, form settings panel, the `PUT /api/forms/[formId]/notifications` route, member removal in `lib/organizations.ts`, response creation in `lib/forms.ts`, new `lib/mailer.ts`, `lib/notification-subscriptions.ts` and `lib/response-notifications.ts` modules, localized copy, deployment docs, `.env.example`, and tests.
- New dependencies: `nodemailer` and `@types/nodemailer`.
- Existing forms and users are unaffected: nobody is subscribed until they turn the switch on, and the new column on `User` is nullable.
