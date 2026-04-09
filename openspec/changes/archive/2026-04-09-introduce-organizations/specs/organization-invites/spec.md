## ADDED Requirements

### Requirement: Organization owner can create and revoke invite links
The system SHALL allow the organization owner to create invite links for that organization and SHALL allow the owner to revoke active invite links.

#### Scenario: Owner creates an invite link
- **WHEN** the organization owner creates an invite link
- **THEN** the system issues a joinable invite link for that organization

#### Scenario: Owner revokes an invite link
- **WHEN** the organization owner revokes an active invite link
- **THEN** the system prevents that link from being used for new joins

### Requirement: Authenticated user can join organization through a valid invite link
The system SHALL allow an authenticated user to join an organization through a valid invite link managed by that organization.

#### Scenario: User joins via valid invite
- **WHEN** an authenticated user opens a valid organization invite link and accepts the invitation
- **THEN** the system adds that user as a member of the organization

#### Scenario: User opens revoked or invalid invite link
- **WHEN** an authenticated user opens an invalid or revoked organization invite link
- **THEN** the system does not add them to the organization

### Requirement: Existing members are not duplicated through invite acceptance
The system SHALL prevent duplicate membership when a user who is already a member opens a valid invite link for the same organization.

#### Scenario: Existing member opens valid invite
- **WHEN** an authenticated user who already belongs to the organization accepts a valid invite link
- **THEN** the system keeps a single membership record and does not create a duplicate
