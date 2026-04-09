## ADDED Requirements

### Requirement: Dashboard views are scoped to the active workspace
The system SHALL scope dashboard form listings to the creator's selected personal or organization workspace.

#### Scenario: Creator views personal workspace dashboard
- **WHEN** an authenticated creator selects their personal workspace in the dashboard
- **THEN** the system shows only forms from that personal workspace

#### Scenario: Creator views organization workspace dashboard
- **WHEN** an authenticated creator selects an organization workspace they belong to in the dashboard
- **THEN** the system shows only forms from that organization workspace
