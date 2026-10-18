## ADDED Requirements

### Requirement: Authenticated creator can manage a notification email in profile settings
The system SHALL allow a signed-in creator to set, change, and clear a notification email in the Profile section of settings. The address SHALL be trimmed and lowercased before storage, SHALL be rejected when it is not a valid email address or longer than 254 characters, and an empty value SHALL be stored as absent. The address SHALL be stored separately from the account email provided by sign-in and SHALL be used only for response notifications.

#### Scenario: Creator saves a notification email
- **WHEN** an authenticated creator enters `  Ada@Example.com ` as the notification email and saves profile settings
- **THEN** the system stores `ada@example.com` and shows it when the Profile section is reopened

#### Scenario: Creator enters an invalid address
- **WHEN** an authenticated creator enters a value that is not an email address and saves profile settings
- **THEN** the system rejects the save with a validation error on the notification email

#### Scenario: Creator clears the notification email
- **WHEN** an authenticated creator empties the notification email and saves profile settings
- **THEN** the system stores the address as absent and sends no response notifications to that creator
