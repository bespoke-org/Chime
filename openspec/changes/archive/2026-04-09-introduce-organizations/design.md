## Context

Lively Forms currently has a simple creator model: a signed-in user owns forms personally and all creator authorization checks are based on `form.userId`. That keeps the product simple for solo usage, but it prevents teams from sharing forms, reviewing responses together, or managing a common workspace.

This change introduces organizations as collaborative workspaces while preserving personal forms. It is cross-cutting because it affects data modeling, access control, dashboard scoping, form creation/editing, response review/export, and new organization management screens.

## Goals / Non-Goals

**Goals:**
- Add organization workspaces without removing personal workspaces.
- Let any signed-in user create an organization and become its owner.
- Let organization owners rename/delete the organization, manage members, and manage invite links.
- Let all organization members use the same form-related permissions within that organization.
- Keep existing personal forms working with minimal migration risk.
- Make workspace context visible in the creator experience so users know whether they are working personally or inside an organization.

**Non-Goals:**
- Granular roles beyond owner vs member in v1.
- Per-form permissions inside an organization.
- Billing, audit logs, or enterprise admin controls.
- Public organization pages or directories.
- Converting organizations into a fully generic workspace abstraction used everywhere in the product.

## Decisions

### 1. Keep personal ownership as-is and add optional organization ownership to forms
Rather than replacing the current model with a generic `Workspace` table, forms should remain personally owned by default and optionally belong to an organization via an `organizationId`. This preserves the current personal-form behavior and reduces migration complexity.

**Why:**
- Existing data and queries already assume personal ownership.
- Personal forms remain first-class without needing a synthetic personal workspace record.
- The migration path is simpler because existing forms can stay attached to their current user.

**Alternatives considered:**
- Full generic workspace abstraction for users and organizations: more flexible long-term, but substantially more invasive for a first collaboration release.
- Organization-only ownership with mandatory migration of all forms: rejected because it weakens the current solo flow.

### 2. Model organization membership with two roles: OWNER and MEMBER
Organizations should use a membership table with exactly two roles in v1. The owner has organization-admin privileges. Members share all form-related permissions equally inside that organization.

**Why:**
- Matches the requested product behavior.
- Keeps authorization rules predictable and easy to explain.
- Avoids premature complexity from editors/admins/viewers.

**Alternatives considered:**
- Multiple granular roles: rejected as out of scope for the first release.
- Owner-only form management with limited members: rejected because the desired collaboration model is equal member access to forms.

### 3. Use invite-link records managed by the organization owner
Invite links should be first-class records tied to an organization and created/revoked by the owner. Joining through a valid invite adds the signed-in user as a member if they are not already in the organization.

**Why:**
- Simple onboarding flow for small teams.
- Supports multiple links over time if needed.
- Gives the owner explicit control over active invite entry points.

**Alternatives considered:**
- Email-only invitations: rejected because the user explicitly requested invite links.
- One permanent invite token per organization: simpler, but weaker lifecycle control than managed invite records.

### 4. Centralize workspace-aware authorization in shared server helpers
The codebase already uses shared helpers in `lib/forms.ts` for ownership checks. This change should extend that pattern with shared access helpers that answer questions like: personal owner? organization member? organization owner?

**Why:**
- Prevents access logic from drifting across routes and pages.
- Makes the transition from personal-only to workspace-aware authorization safer.
- Supports builder, response review, and export consistently.

**Alternatives considered:**
- Inline access checks per route/page: rejected because this change touches too many surfaces.

### 5. Add explicit creator workspace selection in the UI
The creator experience should expose an active workspace context, starting with personal plus any organizations the user belongs to. Dashboard and form creation should use that active context.

**Why:**
- Users need to know where new forms will be created.
- Dashboard lists must be clearly scoped.
- It reduces confusion when the same user belongs to multiple organizations.

**Alternatives considered:**
- Global mixed list of all forms across personal and org contexts: rejected because it makes ownership and creation context ambiguous.
- Separate dedicated organization app section only: rejected because it fragments the creator workflow.

### 6. Treat organization admin as owner-only, but form operations as member-wide
Rename/delete organization, member management, and invite-link management should require owner role. Form creation, editing, publishing, response review, and response export should require membership only.

**Why:**
- Directly matches the requested permission model.
- Cleanly separates organization administration from everyday collaboration.

**Alternatives considered:**
- Owner-only publishing or response access: rejected because members are meant to have the same permissions for workspace work.

## Risks / Trade-offs

- **Workspace-aware access expands many queries** → Centralize helper functions and update creator surfaces incrementally around those helpers.
- **Mixed personal/org ownership can complicate UI wording** → Use explicit workspace labels and creation context in dashboard/builder surfaces.
- **Invite-link misuse or stale links** → Support explicit owner-managed revocation and keep links tied to one organization.
- **Membership edge cases (already a member, owner leaving, delete with active forms)** → Define simple v1 rules and enforce them consistently in server actions.
- **This model may constrain future granular roles** → Keep membership and invite models extensible even if v1 only uses OWNER/MEMBER.

## Migration Plan

- Add organization, membership, and invite-link tables plus optional `organizationId` on forms.
- Keep existing forms as personal forms owned by their current user.
- Update server-side access helpers before exposing organization UI.
- Roll out workspace selection and organization management screens after the data model and authorization layer are in place.
- If rollback is needed, disable organization UI and routes while preserving personal-form behavior.

## Open Questions

- Whether invite links should be single-use or reusable in v1. Initial recommendation: reusable until revoked.
- Whether organization owners can leave the organization without transferring ownership. Initial recommendation: no, ownership must be transferred or the org deleted.
- Whether personal and organization forms should be movable between workspaces in v1. Initial recommendation: not in scope for the initial release.
