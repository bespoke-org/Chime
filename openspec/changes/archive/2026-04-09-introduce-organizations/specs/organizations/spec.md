## ADDED Requirements

### Requirement: Authenticated user can create an organization
The system SHALL allow an authenticated user to create an organization and SHALL make that user the owner of the new organization.

#### Scenario: User creates an organization
- **WHEN** an authenticated user submits a valid organization name
- **THEN** the system creates the organization and records that user as its owner

### Requirement: Organization members share form-workspace permissions
The system SHALL allow every member of an organization to create and manage forms, review responses, and export responses within that organization.

#### Scenario: Member works with organization forms
- **WHEN** an authenticated member opens an organization workspace
- **THEN** the system allows that member to use the same form-related features as any other non-owner member in that organization

### Requirement: Organization owner manages organization administration
The system SHALL restrict organization rename, delete, membership management, and invite-link management to the organization owner.

#### Scenario: Owner renames organization
- **WHEN** the organization owner updates the organization name
- **THEN** the system saves the new organization name

#### Scenario: Owner removes a member
- **WHEN** the organization owner removes a member from the organization
- **THEN** the system revokes that member's access to the organization workspace

#### Scenario: Non-owner attempts organization administration
- **WHEN** a non-owner member attempts to rename, delete, manage members, or manage invite links for the organization
- **THEN** the system denies the request

### Requirement: Creator UI exposes personal and organization workspaces
The system SHALL present a creator with their personal workspace and any organizations they belong to as selectable workspace contexts.

#### Scenario: User belongs to one or more organizations
- **WHEN** an authenticated creator opens the creator experience
- **THEN** the system shows the personal workspace plus each accessible organization as available workspace contexts
