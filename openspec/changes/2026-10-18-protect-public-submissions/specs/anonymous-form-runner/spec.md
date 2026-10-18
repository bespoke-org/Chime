## ADDED Requirements

### Requirement: Public submissions are rate limited per client
The system SHALL count every public submission attempt per client IP and per client IP and form within a sliding time window, SHALL reject attempts above the configured limits with a 429 status, and the runner SHALL show a localized message telling the respondent to try again later. The client IP SHALL be taken from the first `X-Forwarded-For` entry, then `X-Real-IP`, and otherwise a shared fallback key. Limits SHALL be configurable through environment variables with defaults of 5 submissions per form, 30 submissions across all forms, and a 10-minute window.

#### Scenario: Client exceeds the per-form limit
- **WHEN** a client IP sends more submissions to one form than the per-form limit allows within the window
- **THEN** the system rejects the next submission with a 429 status and the runner shows the localized rate-limit message

#### Scenario: Client exceeds the global limit across forms
- **WHEN** a client IP sends more submissions across all forms than the global limit allows within the window
- **THEN** the system rejects the next submission with a 429 status even if the per-form limit for that form is not reached

#### Scenario: Window slides past the oldest attempt
- **WHEN** the oldest counted attempt leaves the window
- **THEN** the system allows exactly one more submission for that key

### Requirement: Submissions that trip bot traps are discarded without feedback
The system SHALL include a hidden honeypot field and the runner start time in the public submission payload outside the answers map. The system SHALL treat a non-empty honeypot value, or a submission arriving sooner than the minimum fill time after a present and valid start time, as a trapped submission. Trapped submissions SHALL receive a success response with a generated identifier and SHALL NOT be stored. A missing, malformed, or future start time SHALL NOT cause a submission to be trapped.

#### Scenario: Bot fills the honeypot
- **WHEN** a submission arrives with a non-empty honeypot value
- **THEN** the system responds as if the submission were accepted and stores no response

#### Scenario: Submission arrives faster than the minimum fill time
- **WHEN** a submission arrives less than the configured minimum fill time after its reported start time
- **THEN** the system responds as if the submission were accepted and stores no response

#### Scenario: Start time is missing or from a skewed clock
- **WHEN** a submission arrives without a start time, with an unparseable start time, or with a start time in the future
- **THEN** the system does not treat the submission as trapped on that basis and continues normal validation

#### Scenario: Respondent never sees the honeypot
- **WHEN** a respondent uses the public runner with a keyboard, mouse, or assistive technology
- **THEN** the honeypot field is not reachable by tab order, is hidden from assistive technology, and is submitted empty
