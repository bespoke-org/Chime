## ADDED Requirements

### Requirement: New responses are delivered to the form's webhook
The system SHALL send one `POST` request with a JSON body to the form's webhook URL after a response is stored, when a URL is configured. The body SHALL contain `event` set to `response.created`, `formId`, `formSlug`, `formTitle`, `responseId`, `submittedAt` as an ISO 8601 timestamp, and `answers` as a list of `{ blockId, type, title, value }` entries for the question blocks the respondent reached, in form order, where `value` is the stored string or list of strings. The request SHALL carry `Content-Type: application/json`, `User-Agent: lively-forms-webhook/1`, `X-Lively-Forms-Event`, and `X-Lively-Forms-Timestamp`.

#### Scenario: Response stored for a form with a webhook
- **WHEN** a respondent submits a published form that has a webhook URL
- **THEN** the system stores the response and sends a `POST` to that URL whose body names the form, the new response id, the submission time, and the reached answers in order

#### Scenario: Response skips a branch
- **WHEN** a respondent's route skips some question blocks
- **THEN** the webhook body lists only the question blocks that were reached and omits text blocks

#### Scenario: Form without a webhook
- **WHEN** a respondent submits a published form that has no webhook URL
- **THEN** the system stores the response and sends no request

### Requirement: Webhook requests are signed when a secret is set
When the form has a signing secret, the system SHALL add `X-Lively-Forms-Signature: sha256=<hex>` where `<hex>` is the HMAC-SHA256 of the string `"<timestamp>.<body>"` keyed with the secret, `<timestamp>` is the value of `X-Lively-Forms-Timestamp` in Unix seconds, and `<body>` is the exact request body. Without a secret the header SHALL be absent.

#### Scenario: Receiver verifies a signed request
- **WHEN** a receiver recomputes HMAC-SHA256 over the timestamp header, a dot, and the raw request body using the form's secret
- **THEN** the result equals the hex digest in the signature header

#### Scenario: Form without a secret
- **WHEN** a webhook is sent for a form with a URL but no secret
- **THEN** the request carries the event and timestamp headers and no signature header

### Requirement: Webhook delivery is bounded and does not affect the response
The system SHALL wait at most 5 seconds for the endpoint to answer, SHALL retry exactly once after 2 seconds when the request fails with a network error, a timeout, or a 5xx status, SHALL NOT retry on a 4xx status, and SHALL NOT follow redirects. The response SHALL be stored and the respondent SHALL receive the success answer regardless of the delivery outcome. Failed deliveries SHALL be written to the server log with the form id and the status or error, without the request body.

#### Scenario: Endpoint answers 5xx twice
- **WHEN** the endpoint answers with a 5xx status on both attempts
- **THEN** the system logs the failure with the form id and status, makes no further attempt, and the respondent still sees the success screen

#### Scenario: Endpoint answers 4xx
- **WHEN** the endpoint answers with a 4xx status
- **THEN** the system makes no second attempt and the response remains stored

#### Scenario: Endpoint does not answer
- **WHEN** the endpoint does not answer within 5 seconds
- **THEN** the system aborts the request, retries once, and the respondent's submission is not delayed or failed by it
