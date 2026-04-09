## MODIFIED Requirements

### Requirement: Creator can list responses for owned forms
The system SHALL allow an authenticated creator to view submitted responses for personal forms they own and organization forms belonging to organizations where they are members, and SHALL prevent them from listing responses for forms outside those accessible workspaces.

#### Scenario: Creator opens responses for a personal form they own
- **WHEN** an authenticated creator opens the responses view for a personal form they own
- **THEN** the system displays the submitted responses for that form

#### Scenario: Creator opens responses for an organization form in a joined organization
- **WHEN** an authenticated creator opens the responses view for a form belonging to an organization where they are a member
- **THEN** the system displays the submitted responses for that form

#### Scenario: Creator opens responses for an inaccessible form
- **WHEN** an authenticated creator opens the responses view for a form they do not own personally and that does not belong to an organization they are part of
- **THEN** the system denies access to that form's submitted responses

### Requirement: Creator can start response exports from the responses view
The system SHALL present response export actions in the responses view for a form in a workspace the authenticated creator can access.

#### Scenario: Creator opens responses for an accessible form
- **WHEN** an authenticated creator opens the responses view for a form in a workspace they can access
- **THEN** the system displays available export actions for the supported response export formats
