## MODIFIED Requirements

### Requirement: Creator can configure a response webhook per form
The system SHALL allow an authenticated creator to manage up to 10 webhooks on any accessible form, each with a URL, an optional signing secret, an enabled switch and a delivery mode: each response as it arrives, or a digest that is hourly, daily at a time of day, or weekly on a weekday at a time of day. Each webhook SHALL be created, changed and removed through its own request, saved at once and independently of the other form settings. Each URL SHALL be accepted only when it uses `http` or `https`, carries no credentials, is at most 2048 characters, and does not point at a loopback, private, link-local, or unspecified address or at a `.local` or `.internal` hostname. Each secret SHALL be at most 200 characters, and an empty secret SHALL be stored as absent. A digest webhook SHALL require an interval; a daily or weekly one SHALL require a time of day in the `HH:MM` form; a weekly one SHALL require a weekday. The settings panel SHALL list webhooks as rows with the URL, the mode, the schedule, the enabled switch, and edit and remove actions, and SHALL open an inline editor for one webhook at a time; the time field SHALL name the zone the time is read in. No webhook URL or secret SHALL be included in the public form payload.

#### Scenario: Creator adds a digest webhook
- **WHEN** an authenticated creator adds a webhook with a public URL, chooses the digest mode with a daily interval and a time, and saves it
- **THEN** the system stores it at once, and the list shows the URL, a digest badge and the daily schedule without saving form settings

#### Scenario: Creator pauses a webhook
- **WHEN** an authenticated creator switches a webhook off in the list
- **THEN** the system saves it at once and sends it no requests until it is switched on again

#### Scenario: Creator saves a webhook URL on a private network
- **WHEN** an authenticated creator enters a webhook URL whose host is `localhost`, a `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, or `169.254.0.0/16` address, `0.0.0.0`, `::1`, or ends in `.local` or `.internal`, and saves the webhook
- **THEN** the system rejects it with a validation error

#### Scenario: Creator adds more than ten webhooks
- **WHEN** a form already has 10 webhooks
- **THEN** the add button is disabled and the server answers `422` to a further create request

#### Scenario: Creator removes a webhook
- **WHEN** an authenticated creator removes a webhook from the list
- **THEN** the system no longer stores it and sends it no later requests

#### Scenario: Respondent loads the public form
- **WHEN** the public form is loaded by a respondent
- **THEN** the payload contains no webhook URL and no signing secret
