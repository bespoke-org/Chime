## MODIFIED Requirements

### Requirement: Creator ownership is enforced for managed forms
The system SHALL allow creators to manage personal forms they own and organization forms belonging to organizations where they are members, and SHALL prevent access to editing, publishing, response review, or response export for forms outside those accessible workspaces.

#### Scenario: Creator opens a personal form they own
- **WHEN** an authenticated creator requests a personal form they own
- **THEN** the system allows them to edit and manage that form

#### Scenario: Creator opens an organization form in a joined organization
- **WHEN** an authenticated creator requests a form belonging to an organization where they are a member
- **THEN** the system allows them to manage that form according to organization membership access

#### Scenario: Creator opens another creator's inaccessible form
- **WHEN** an authenticated creator requests a form they do not own personally and that does not belong to an organization they are part of
- **THEN** the system denies access to form management, response review, and response export for that form
