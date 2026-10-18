## 1. Persist the settings

- [x] 1.1 Add nullable `User.notificationEmail` and `Form.notifyOnResponse` with default `false` in one migration
- [x] 1.2 Validate `notificationEmail` in `profileSettingsSchema`: trim, lowercase, empty to `null`, email check, 254 character limit
- [x] 1.3 Validate `notifyOnResponse` in `formMetadataSchema` as a strict boolean with default `false`
- [x] 1.4 Thread `notifyOnResponse` and `ownerHasNotificationEmail` through `BuilderForm` and `toBuilderForm`
- [x] 1.5 Add schema tests for trimming, lowercasing, empty values, malformed and over-long addresses, and the boolean switch

## 2. Settings UI

- [x] 2.1 Add the notification email input and help text to the profile settings panel and save flow
- [x] 2.2 Add a Notifications section with the per-form switch to the form settings panel, draft, and save flow
- [x] 2.3 Show a hint with a link to profile settings when the form owner has no notification email
- [x] 2.4 Add the copy in `en` and `ru`

## 3. Sending

- [x] 3.1 Add `nodemailer` and `@types/nodemailer`
- [x] 3.2 Add `lib/mailer.ts` with `getMailerConfig`, `isMailerConfigured`, a lazy transport, and a `sendMail` that never throws and logs only the recipient domain, with config tests
- [x] 3.3 Add `buildResponseNotificationEmail` with localized subject and labels, export-style answer serialization, HTML escaping, and the response link, with tests
- [x] 3.4 Add `notifyOwnerOfResponse` that skips disabled forms, an unconfigured mailer, and owners without an address, sends otherwise, never throws, and has a swappable mailer, with tests on a mocked database
- [x] 3.5 Call the notifier from `createAnonymousResponse` after the insert without awaiting it, with tests proving the stored response does not depend on it

## 4. Documentation

- [x] 4.1 Describe the setting, the SMTP variables, and the no-SMTP behavior in `docs/deployment.md` and `.env.example`
- [x] 4.2 List nodemailer in the README stack
