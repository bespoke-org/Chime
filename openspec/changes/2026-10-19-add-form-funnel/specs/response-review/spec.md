## ADDED Requirements

### Requirement: Creator sees the response funnel of a form
The system SHALL show on the responses page of an accessible form the number of browsers that opened it, the number that started it with their share of opened, and the number of submitted responses with their share of opened. Shares SHALL be rounded to whole percent and capped at 100%. When no visit is recorded the shares SHALL be shown as a dash.

#### Scenario: Creator opens responses of a shared form
- **WHEN** 10 browsers opened a form, 4 started it, and 2 responses were submitted
- **THEN** the responses page shows opened 10, started 4 with 40%, and submitted 2 with 20%

#### Scenario: Form collected responses before visits were tracked
- **WHEN** a form has 12 responses and 4 recorded visits
- **THEN** the submitted share is shown as 100%

#### Scenario: Form has no recorded visits
- **WHEN** a form has responses but no recorded visits
- **THEN** the started and submitted shares are shown as a dash
