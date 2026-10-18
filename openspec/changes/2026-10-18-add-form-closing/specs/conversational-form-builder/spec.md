## ADDED Requirements

### Requirement: Creator can configure when a form stops accepting responses
The system SHALL allow an authenticated creator to save, in the settings of any accessible form, an optional closing time, an optional response limit between 1 and 1,000,000, a manual closed switch, and a closed message of at most 1000 characters. Empty closing time and limit SHALL be stored as absent. The closing time SHALL be entered in the creator's local time and stored as an instant. An empty closed message SHALL mean the localized default message is shown to respondents. The settings panel SHALL state which rule currently closes a published form.

#### Scenario: Creator sets a closing time
- **WHEN** an authenticated creator picks a closing time in the settings panel and saves form settings
- **THEN** the system stores that instant and shows it again in the creator's local time when the settings are reopened

#### Scenario: Creator sets a response limit
- **WHEN** an authenticated creator enters `50` as the response limit and saves form settings
- **THEN** the system stores the limit and the form stops accepting responses once 50 are stored

#### Scenario: Creator enters an invalid limit
- **WHEN** an authenticated creator enters `0`, a negative number, a fraction, or a number above 1,000,000 as the response limit and saves form settings
- **THEN** the system rejects the save with a validation error

#### Scenario: Creator closes the form manually
- **WHEN** an authenticated creator enables the manual closed switch and saves form settings on a published form
- **THEN** the form stays published, the builder shows the `Closed` status and a line saying the form is closed manually, and respondents see the closed message

#### Scenario: Creator clears all closing rules
- **WHEN** an authenticated creator empties the closing time and limit, disables the manual switch, and saves form settings
- **THEN** the published form accepts responses again
