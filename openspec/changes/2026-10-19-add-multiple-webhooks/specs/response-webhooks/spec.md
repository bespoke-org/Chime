## MODIFIED Requirements

### Requirement: New responses are delivered to the form's webhook
The system SHALL send one `POST` request with a JSON body to each webhook of the form after a response is stored. Every webhook SHALL receive the same body, which SHALL contain `event` set to `response.created`, `formId`, `formSlug`, `formTitle`, `responseId`, `submittedAt` as an ISO 8601 timestamp, and `answers` as a list of `{ blockId, type, title, value }` entries for the question blocks the respondent reached, in form order, where `value` is the stored string or list of strings. Each request SHALL carry `Content-Type: application/json`, `User-Agent: chime-webhook/1`, `X-Chime-Event`, and `X-Chime-Timestamp`, and SHALL be signed with that webhook's own secret when it has one. Deliveries SHALL be independent: the outcome of one SHALL NOT delay or prevent another.

#### Scenario: Response stored for a form with two webhooks
- **WHEN** a respondent submits a published form that has two webhooks
- **THEN** the system stores the response and sends the same body to both URLs, each signed with its own secret if set

#### Scenario: One endpoint is down
- **WHEN** one of the form's webhook endpoints times out
- **THEN** the other webhooks are still delivered and the respondent's submission is not affected

#### Scenario: Response skips a branch
- **WHEN** a respondent's route skips some question blocks
- **THEN** the webhook body lists only the question blocks that were reached and omits text blocks

#### Scenario: Form without webhooks
- **WHEN** a respondent submits a published form that has no webhooks
- **THEN** the system stores the response and sends no request
