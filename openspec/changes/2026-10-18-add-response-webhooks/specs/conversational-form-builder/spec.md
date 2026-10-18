## ADDED Requirements

### Requirement: Creator can configure a response webhook per form
The system SHALL allow an authenticated creator to save a webhook URL and an optional signing secret in the settings of any accessible form. The URL SHALL be accepted only when it uses `http` or `https`, carries no credentials, is at most 2048 characters, and does not point at a loopback, private, link-local, or unspecified address or at a `.local` or `.internal` hostname. The secret SHALL be at most 200 characters. Empty values SHALL be stored as absent. Neither value SHALL be included in the public form payload.

#### Scenario: Creator saves a public webhook URL
- **WHEN** an authenticated creator enters `https://hooks.example.com/forms` as the webhook URL and saves form settings
- **THEN** the system persists the URL on the form and shows it when the settings are reopened

#### Scenario: Creator saves a webhook URL on a private network
- **WHEN** an authenticated creator enters a webhook URL whose host is `localhost`, a `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, or `169.254.0.0/16` address, `0.0.0.0`, `::1`, or ends in `.local` or `.internal`, and saves form settings
- **THEN** the system rejects the save with a validation error on the webhook URL

#### Scenario: Creator clears the webhook
- **WHEN** an authenticated creator empties the webhook URL and secret and saves form settings
- **THEN** the system stores both as absent and sends no webhook for later responses

#### Scenario: Respondent loads the public form
- **WHEN** the public form is loaded by a respondent
- **THEN** the payload contains neither the webhook URL nor the signing secret
