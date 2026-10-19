## ADDED Requirements

### Requirement: Organization owners configure webhooks for all forms of the organization
The system SHALL allow the owner of an organization to create, change and remove up to 10 webhooks on the organization, with the same fields and validation as form webhooks. An organization webhook SHALL apply to every form of the organization, including forms created after it, and SHALL send the same `response.created` and `responses.batch` bodies as a form webhook, signed with its own secret. A member who is not the owner SHALL get `403` and a user outside the organization `404` for any request on organization webhooks. Form settings of an organization form SHALL list the organization's webhooks to every member as read-only rows with the URL, the mode and the schedule, marked as coming from the workspace, without the secret.

#### Scenario: Owner adds an organization webhook
- **WHEN** the owner adds an immediate webhook in the workspace settings
- **THEN** every later response to any form of the organization, including a form created afterwards, is sent to it

#### Scenario: Member tries to change an organization webhook
- **WHEN** a member who is not the owner sends a create, change or remove request for an organization webhook
- **THEN** the system answers `403` and changes nothing

#### Scenario: Member opens form settings
- **WHEN** a member opens the settings of an organization form
- **THEN** the organization webhooks are listed read-only, marked as from the workspace, with no secret

### Requirement: An endpoint configured on a form and its organization gets each event once
Two webhook URLs SHALL be treated as the same endpoint when they are equal after lowercasing the scheme and host, dropping a default port, a trailing `/` of the path and a fragment; the query SHALL be kept. When an enabled form webhook and an organization webhook of the form's organization are the same endpoint and have the same mode, the system SHALL send that form's event only through the form webhook. Webhooks with different modes SHALL both send.

#### Scenario: Same URL on form and organization
- **WHEN** a form has an immediate webhook to `https://hooks.example.com/x` and its organization an immediate webhook to `HTTPS://Hooks.example.com/x/`
- **THEN** a new response is sent once, signed with the form webhook's secret

#### Scenario: Same URL, different modes
- **WHEN** a form has a digest webhook and its organization an immediate webhook to the same URL
- **THEN** each response is sent by the organization webhook and the form's digest is sent by the form webhook

### Requirement: Organization digests send one batch series per form
A digest organization webhook SHALL have one schedule and one covered period. When a slot passes, the system SHALL send, for each form of the organization with responses in the period, that form's `responses.batch` requests with the webhook's `periodStart` and `periodEnd`, split into parts as for a form webhook. A form with an enabled digest webhook to the same endpoint SHALL be left out. When any request of the period fails, the system SHALL apply the retry and 24-hour rules to the whole period, so forms already delivered in the failed run MAY be sent again with the same `formId`, `periodStart` and `part`.

#### Scenario: Daily organization digest
- **WHEN** a daily organization webhook is due and two of its three forms have responses in the period
- **THEN** the system sends one `responses.batch` series for each of those two forms with the same period bounds

#### Scenario: Form with its own digest to the same URL
- **WHEN** an organization form has its own enabled digest webhook to the same endpoint
- **THEN** the organization digest leaves that form out and the form webhook sends its batch

#### Scenario: One form fails
- **WHEN** the batch of the second form of the period gets a 5xx answer
- **THEN** the period stays uncovered and the next check sends the batches of all forms of the period again
