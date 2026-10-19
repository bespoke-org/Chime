## ADDED Requirements

### Requirement: Runner reports form visits without personal data
The system SHALL record one visit per browser per published form when a respondent opens the form, and SHALL mark that visit as started when the respondent gives the first answer or moves past the first step. The browser SHALL be identified only by a random id kept in `localStorage`; the system SHALL NOT store IP addresses or user agents for visits. Visits by a signed-in user who can edit the form SHALL NOT be recorded. Recording SHALL NOT block or alter the runner, and the endpoint SHALL answer `204` for unpublished or unknown forms without recording.

#### Scenario: Respondent opens a form twice
- **WHEN** a respondent opens the same published form twice in one browser
- **THEN** the system keeps one visit for that browser

#### Scenario: Respondent answers the first question
- **WHEN** a respondent who opened a published form enters the first answer
- **THEN** the system marks the visit as started

#### Scenario: Author previews the form
- **WHEN** a signed-in member of the form's workspace opens the published form
- **THEN** the system records no visit

#### Scenario: Storage is unavailable
- **WHEN** the respondent's browser blocks `localStorage`
- **THEN** the runner works as before and no visit is recorded
