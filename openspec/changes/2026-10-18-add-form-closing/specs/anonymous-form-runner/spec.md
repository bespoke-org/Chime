## ADDED Requirements

### Requirement: Closed published forms show a closed screen and refuse submissions
The system SHALL treat a published form as closed when its manual closed switch is on, when the current time is at or after its closing time, or when the number of stored responses is at or above its response limit. For a closed published form the public page SHALL show the form title and the form's closed message, or the localized default `This form is no longer accepting responses.` when no message is saved, instead of the questions. A submission to a closed form SHALL be refused with HTTP `410` and SHALL NOT be stored, and the runner SHALL show the same closed message. Unpublished forms SHALL keep answering `404`.

#### Scenario: Respondent opens a form after its closing time
- **WHEN** a respondent opens a published form whose closing time has passed
- **THEN** the system shows the form title and the closed message in the respondent's resolved locale and shows no question blocks

#### Scenario: Respondent opens a form that reached its limit
- **WHEN** a respondent opens a published form whose stored response count equals its response limit
- **THEN** the system shows the closed screen

#### Scenario: Respondent submits while the form closes
- **WHEN** a respondent who loaded the form while it was open submits after it became closed
- **THEN** the system answers `410`, stores no response, and the runner shows the closed message

#### Scenario: Form has a custom closed message
- **WHEN** a respondent opens or submits to a closed form whose creator saved a closed message
- **THEN** the system shows the saved message rather than the default

#### Scenario: Respondent opens an unpublished form
- **WHEN** a respondent opens a form that is not published
- **THEN** the system answers with the existing not-found page
