## ADDED Requirements

### Requirement: Subscribed members are emailed about each new response
When a response is stored, the system SHALL send one email to the notification email of every user subscribed to the form, each in that user's language. The subject SHALL name the form title. The body SHALL list each question block the respondent reached, in form order, with its title (or a numbered placeholder when the title is empty) and the answer rendered as in exports: list answers joined with ` | ` and agreement answers as localized labels. The body SHALL end with a link to the response page under the app's public URL. The subject and labels SHALL follow each recipient's language preference, falling back to English. The email SHALL carry a plain text version that is complete on its own and an HTML version in which titles, answers, and the link are escaped.

#### Scenario: Response stored for a form with two subscribers
- **WHEN** a respondent submits a published form that two members with notification emails are subscribed to
- **THEN** the system stores the response and sends one email to each of them with the form title, the reached answers in order, and a link to the response

#### Scenario: Recipients prefer different languages
- **WHEN** one subscriber's language preference is Russian and another's is English
- **THEN** each receives the email with the subject and labels in their own language

#### Scenario: Response contains markup
- **WHEN** a question title or an answer contains HTML markup
- **THEN** the HTML version shows the markup as text and the plain text version shows it unchanged

### Requirement: Notifications are skipped when they cannot be delivered
The system SHALL send no email when the form has no subscribers, to subscribers without a notification email, or when the mailer is not configured. When the mailer is not configured the system SHALL NOT read the subscriptions and SHALL write one warning to the server log per process, not one per response. When a member is removed from an organization their subscriptions on its forms SHALL be deleted.

#### Scenario: No subscribers
- **WHEN** a respondent submits a form nobody is subscribed to
- **THEN** the system stores the response and sends no email

#### Scenario: Subscriber without a notification email
- **WHEN** a respondent submits a form with a subscriber who has no notification email
- **THEN** the system stores the response and sends no email to that subscriber

#### Scenario: SMTP not configured
- **WHEN** `MAIL_FROM` or an SMTP host is missing from the environment
- **THEN** the system stores the response, sends no email, and does not read the subscriptions

#### Scenario: Member removed from the organization
- **WHEN** the owner removes a member from an organization
- **THEN** that member's subscriptions on the organization's forms are deleted and later responses are not emailed to them

### Requirement: Sending does not affect the response and leaks nothing to the log
The response SHALL be stored and the respondent SHALL receive the success answer regardless of the email outcome. A failed send SHALL be written to the server log with the form id and the recipient's domain or the error, and SHALL NOT prevent the emails to the other subscribers; addresses, subjects, and message bodies SHALL NOT be written to the log.

#### Scenario: SMTP server refuses the message
- **WHEN** the SMTP server rejects or does not answer the send
- **THEN** the response remains stored, the respondent sees the success screen, and the log carries the form id and the failure without the address or the content

#### Scenario: Mailer throws
- **WHEN** the sending step throws an error
- **THEN** the system catches it, logs the form id and the error message, and the response creation completes normally
