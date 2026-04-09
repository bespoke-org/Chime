## Why

Lively Forms currently treats every form as a single user’s personal resource, which blocks teams from collaborating in a shared workspace. Adding organizations now unlocks multi-user use cases while keeping permissions simple: all members can work with organization forms, and only the organization owner handles organization administration.

## What Changes

- Add organizations as a new shared workspace type alongside a user’s personal workspace.
- Allow a signed-in user to create an organization and become its owner.
- Allow organization owners to generate and manage invite links for joining the organization.
- Allow invited users to join an organization through an invite link.
- Grant all organization members the same permissions for organization forms, responses, and exports.
- Restrict organization rename, delete, membership management, and invite-link management to the organization owner.
- **BREAKING** Change creator access semantics from strictly user-owned forms to workspace-based access covering personal and organization-owned forms.

## Capabilities

### New Capabilities
- `organizations`: Create and manage organizations, members, and owner-only organization administration.
- `organization-invites`: Join organizations through invite links managed by the organization owner.

### Modified Capabilities
- `creator-auth`: Expand creator authorization from personal ownership only to workspace-aware access for personal and organization resources.
- `conversational-form-builder`: Allow creators to create and manage forms within a selected personal or organization workspace.
- `dashboard-form-views`: Update dashboard browsing so creators can view forms within the active workspace context.
- `response-review`: Allow organization members to review responses for organization forms they can access.
- `response-export`: Allow organization members to export responses for organization forms they can access.

## Impact

- Affected areas: authentication/authorization, form ownership model, dashboard context, builder flows, response review/export, and new organization management surfaces.
- Likely code: Prisma schema, auth/session helpers, form query helpers in `lib/forms.ts`, dashboard pages, builder pages, response pages, and new organization routes/components.
- Likely systems: workspace selection in the creator UI, membership checks, invite-link lifecycle handling, and migration of existing forms into a personal-workspace model.
