## ADDED Requirements

### Requirement: Creator can turn on email notifications per form
The system SHALL allow an authenticated creator to turn on or off, in the settings of any accessible form, an email notification to the form owner for each new response. The setting SHALL default to off for existing and new forms. When the form owner has no notification email, the settings panel SHALL say so and SHALL link to profile settings.

#### Scenario: Creator turns notifications on
- **WHEN** an authenticated creator checks "Email me on each new response" and saves form settings
- **THEN** the system persists the setting on the form and shows it checked when the settings are reopened

#### Scenario: Creator leaves notifications off
- **WHEN** an authenticated creator saves form settings without touching the notification switch
- **THEN** the system keeps the setting off and sends no email for later responses

#### Scenario: Form owner has no notification email
- **WHEN** an authenticated creator opens settings for a form whose owner has no notification email
- **THEN** the system shows a note that no emails are sent and a link to profile settings
