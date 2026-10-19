## MODIFIED Requirements

### Requirement: New responses are delivered to the form's webhook
The system SHALL send one `POST` request with a JSON body to each enabled webhook of the form whose mode is `IMMEDIATE` after a response is stored. Every such webhook SHALL receive the same body, which SHALL contain `event` set to `response.created`, `formId`, `formSlug`, `formTitle`, `formUrl`, `responseId`, `responseUrl`, `submittedAt` as an ISO 8601 timestamp, `identity`, and `answers` as a list of `{ blockId, type, title, value }` entries for the question blocks the respondent reached, in form order, where `value` is the stored string or list of strings. Each request SHALL carry `Content-Type: application/json`, `User-Agent: lively-forms-webhook/1`, `X-Lively-Forms-Event`, and `X-Lively-Forms-Timestamp`, and SHALL be signed with that webhook's own secret when it has one. Deliveries SHALL be independent: the outcome of one SHALL NOT delay or prevent another. Disabled webhooks and webhooks in `DIGEST` mode SHALL receive no `response.created` request.

#### Scenario: Response stored for a form with two immediate webhooks
- **WHEN** a respondent submits a published form that has two enabled immediate webhooks
- **THEN** the system stores the response and sends the same body to both URLs, each signed with its own secret if set

#### Scenario: One endpoint is down
- **WHEN** one of the form's webhook endpoints times out
- **THEN** the other webhooks are still delivered and the respondent's submission is not affected

#### Scenario: Disabled and digest webhooks
- **WHEN** a respondent submits a form that has a disabled webhook and a digest webhook
- **THEN** neither receives a `response.created` request

#### Scenario: Form without webhooks
- **WHEN** a respondent submits a published form that has no webhooks
- **THEN** the system stores the response and sends no request

## ADDED Requirements

### Requirement: Digest webhooks receive responses in periodic batches
A webhook in `DIGEST` mode SHALL have a schedule: `HOURLY`, `DAILY` with a time of day, or `WEEKLY` with a weekday and a time of day. Times SHALL be read in the zone named by `DIGEST_TIMEZONE` (default `Europe/Saratov`). The schedule SHALL define slots: every top of the hour, the time of day each day, or the time of day on the weekday each week. When a slot has passed, the system SHALL send one `POST` request with `event` set to `responses.batch`, `formId`, `formSlug`, `formTitle`, `periodStart`, `periodEnd`, `part`, `parts`, and `responses`, a list ordered by `submittedAt` of `{ responseId, submittedAt, identity, answers }` entries with the same values as the `response.created` body of each response stored after `periodStart` up to and including `periodEnd`. `periodEnd` SHALL be the slot and `periodStart` the previous slot the webhook covered, or the webhook's creation or last schedule change when none. A request SHALL carry at most 200 responses; a longer period SHALL be sent as several requests in the same run with `part` counting from 1 to `parts` and the same period bounds. Requests SHALL carry the same headers and signature as `response.created`, with `X-Lively-Forms-Event: responses.batch`.

#### Scenario: Daily digest with responses
- **WHEN** a daily webhook at 09:00 has three responses stored since the previous day's 09:00 and the clock in the digest zone passes 09:00
- **THEN** the system sends one `responses.batch` request with the three responses ordered by `submittedAt`, `periodStart` at yesterday's 09:00 and `periodEnd` at today's 09:00

#### Scenario: Period without responses
- **WHEN** a slot passes and no response was stored in the period
- **THEN** no request is sent and the slot counts as covered

#### Scenario: More than 200 responses
- **WHEN** a period holds 250 responses
- **THEN** the system sends two requests in the same run, `part` 1 of 2 with 200 responses and `part` 2 of 2 with 50, both with the same `periodStart` and `periodEnd`

#### Scenario: Webhook created after today's slot
- **WHEN** a daily webhook at 09:00 is created at 10:00
- **THEN** its first batch is sent at the next day's 09:00 and covers responses stored after its creation

### Requirement: Missed and failed digests are sent once
The system SHALL check digest webhooks at least once a minute while the server runs and SHALL provide a command that performs one check for a scheduler outside the server. When several slots of a webhook have passed without a check, the system SHALL send one batch covering all of them, ending at the latest slot. When a batch is not delivered, the system SHALL retry the same period on later checks; when the period is more than 24 hours old, the system SHALL skip it and write a warning to the server log. Two overlapping checks SHALL NOT send the same period twice.

#### Scenario: Downtime over several slots
- **WHEN** an hourly webhook was last covered at 03:00 and the server starts again at 10:05
- **THEN** one batch covering 03:00 to 10:00 is sent, not seven

#### Scenario: Delivery fails
- **WHEN** the batch for a period gets a 5xx answer after the retry
- **THEN** the period stays uncovered and the next check sends it again

#### Scenario: Failures for more than a day
- **WHEN** the batches of a webhook have failed for more than 24 hours since its last covered slot
- **THEN** the period is marked covered without delivery and a warning names the webhook, the form and the number of responses skipped
