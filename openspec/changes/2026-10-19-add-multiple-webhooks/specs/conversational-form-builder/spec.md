## MODIFIED Requirements

### Requirement: Creator can configure a response webhook per form
The system SHALL allow an authenticated creator to save up to 10 webhooks in the settings of any accessible form, each with a URL and an optional signing secret. Each URL SHALL be accepted only when it uses `http` or `https`, carries no credentials, is at most 2048 characters, and does not point at a loopback, private, link-local, or unspecified address or at a `.local` or `.internal` hostname. Each secret SHALL be at most 200 characters, and an empty secret SHALL be stored as absent. A webhook saved with an empty URL SHALL be dropped. Saving form settings SHALL replace the form's webhooks with the saved list in its order. The settings panel SHALL show a webhook card only for webhooks the creator has added. No webhook URL or secret SHALL be included in the public form payload.

#### Scenario: Creator adds a first webhook
- **WHEN** an authenticated creator opens the settings of a form without webhooks
- **THEN** the panel shows the Webhooks heading with an add button and no webhook fields

#### Scenario: Creator saves two webhooks
- **WHEN** an authenticated creator adds two cards with public URLs and saves form settings
- **THEN** the system persists both in that order and shows both cards when the settings are reopened

#### Scenario: Creator saves a webhook URL on a private network
- **WHEN** an authenticated creator enters a webhook URL whose host is `localhost`, a `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, or `169.254.0.0/16` address, `0.0.0.0`, `::1`, or ends in `.local` or `.internal`, and saves form settings
- **THEN** the system rejects the save with a validation error on that webhook URL

#### Scenario: Creator adds more than ten webhooks
- **WHEN** a form already has 10 webhook cards in the panel
- **THEN** the add button is disabled and the server rejects a list longer than 10

#### Scenario: Creator removes a webhook
- **WHEN** an authenticated creator removes a card and saves form settings
- **THEN** the system no longer stores that webhook and sends it no later responses

#### Scenario: Respondent loads the public form
- **WHEN** the public form is loaded by a respondent
- **THEN** the payload contains no webhook URL and no signing secret
