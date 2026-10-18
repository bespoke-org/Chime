## ADDED Requirements

### Requirement: Each member can subscribe to email notifications per form
The system SHALL allow an authenticated creator to turn on or off, in the settings of any accessible form, an email notification to themselves for each new response. The subscription SHALL belong to the creator, not to the form: other members of the same workspace SHALL see and change their own switch. It SHALL default to off and SHALL be saved as soon as it is toggled, without the form settings save button; when saving fails the switch SHALL return to its previous state and an error SHALL be shown. When the creator has no notification email, the settings panel SHALL say so and SHALL link to profile settings.

#### Scenario: Creator turns notifications on
- **WHEN** an authenticated creator checks "Email me about new responses"
- **THEN** the system persists a subscription for that creator and form at once and shows it checked when the settings are reopened

#### Scenario: Another member opens the same form
- **WHEN** a different member of the organization opens settings for a form another member subscribed to
- **THEN** the switch is shown unchecked for them until they turn it on themselves

#### Scenario: Creator has no notification email
- **WHEN** an authenticated creator opens settings for a form while having no notification email
- **THEN** the system shows a note that no emails are sent to them and a link to profile settings
