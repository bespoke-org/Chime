## ADDED Requirements

### Requirement: The form owner is emailed about each new response
When a response is stored for a form whose notification setting is on, the system SHALL send one email to the notification email of the form owner, also for forms in an organization workspace. The subject SHALL name the form title. The body SHALL list each question block the respondent reached, in form order, with its title (or a numbered placeholder when the title is empty) and the answer rendered as in exports: list answers joined with ` | ` and agreement answers as localized labels. The body SHALL end with a link to the response page under the app's public URL. The subject and labels SHALL follow the owner's language preference, falling back to English. The email SHALL carry a plain text version that is complete on its own and an HTML version in which titles, answers, and the link are escaped.

#### Scenario: Response stored for a form with notifications on
- **WHEN** a respondent submits a published form whose owner has a notification email and whose notification setting is on
- **THEN** the system stores the response and sends one email to that address with the form title, the reached answers in order, and a link to the response

#### Scenario: Owner prefers Russian
- **WHEN** the form owner's language preference is Russian
- **THEN** the subject and labels of the email are in Russian

#### Scenario: Response contains markup
- **WHEN** a question title or an answer contains HTML markup
- **THEN** the HTML version shows the markup as text and the plain text version shows it unchanged

### Requirement: Notifications are skipped when they cannot be delivered
The system SHALL send no email when the form's notification setting is off, when the owner has no notification email, or when the mailer is not configured. When the mailer is not configured the system SHALL NOT read the owner record and SHALL write one warning to the server log per process, not one per response.

#### Scenario: Notification setting off
- **WHEN** a respondent submits a form whose notification setting is off
- **THEN** the system stores the response and neither reads the owner record nor sends an email

#### Scenario: Owner without a notification email
- **WHEN** a respondent submits a form whose notification setting is on but whose owner has no notification email
- **THEN** the system stores the response and sends no email

#### Scenario: SMTP not configured
- **WHEN** `MAIL_FROM` or an SMTP host is missing from the environment
- **THEN** the system stores the response, sends no email, and does not read the owner record

### Requirement: Sending does not affect the response and leaks nothing to the log
The response SHALL be stored and the respondent SHALL receive the success answer regardless of the email outcome. A failed send SHALL be written to the server log with the form id and the recipient's domain or the error; addresses, subjects, and message bodies SHALL NOT be written to the log.

#### Scenario: SMTP server refuses the message
- **WHEN** the SMTP server rejects or does not answer the send
- **THEN** the response remains stored, the respondent sees the success screen, and the log carries the form id and the failure without the address or the content

#### Scenario: Mailer throws
- **WHEN** the sending step throws an error
- **THEN** the system catches it, logs the form id and the error message, and the response creation completes normally
