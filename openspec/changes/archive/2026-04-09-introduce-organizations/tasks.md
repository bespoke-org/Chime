## 1. Data model and migration

- [x] 1.1 Add Prisma models for organizations, memberships, and invite links.
- [x] 1.2 Add optional organization ownership fields to forms while preserving personal ownership.
- [x] 1.3 Generate and apply the migration for the new organization data model.
- [x] 1.4 Update shared TypeScript/domain types for workspace-aware forms and organization entities.

## 2. Workspace-aware authorization

- [x] 2.1 Add shared server helpers for personal ownership, organization membership, and organization-owner checks.
- [x] 2.2 Refactor form, response review, and response export access checks to use workspace-aware authorization.
- [x] 2.3 Prevent non-owner members from performing organization admin actions.

## 3. Organization and invite flows

- [x] 3.1 Add server endpoints or actions to create, rename, and delete organizations.
- [x] 3.2 Add server endpoints or actions to list members, remove members, and manage invite links.
- [x] 3.3 Add the authenticated join flow for valid organization invite links.
- [x] 3.4 Handle duplicate-member and revoked/invalid-invite cases cleanly.

## 4. Creator workspace UI

- [x] 4.1 Add creator UI for selecting the active personal or organization workspace.
- [x] 4.2 Scope dashboard form listings to the active workspace.
- [x] 4.3 Update form creation so a new form is created in the selected workspace.
- [x] 4.4 Show workspace context in the builder and responses surfaces.
- [x] 4.5 Add organization settings UI for owner-only admin actions and invite-link management.

## 5. Verification

- [x] 5.1 Verify personal-form flows still work after introducing organizations.
- [x] 5.2 Verify organization members can create/manage forms and review/export responses in the organization workspace.
- [x] 5.3 Verify non-member access is denied and non-owner org admin actions are denied.
- [x] 5.4 Run the production build and fix any type, migration, or route issues introduced by the change.
