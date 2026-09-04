## Why

The app currently depends on Google OAuth for creator sign-in, but the desired login path is an ATProto identity hosted on the user's PDS. Switching to ATProto OAuth aligns creator identity with Bluesky/AT Protocol accounts while preserving the existing authenticated creator experience.

## What Changes

- Replace Google OAuth as the creator sign-in provider with ATProto OAuth using a user-supplied handle/PDS identity flow.
- Initialize missing creator profile fields from AT Protocol profile data, including display name and avatar when available.
- Update sign-in UI, localized copy, environment/config documentation, and troubleshooting text to reference ATProto/PDS sign-in instead of Google OAuth.
- Preserve existing creator-managed profile fields and locale on repeated sign-ins.
- **BREAKING**: Deployments currently configured only for Google OAuth credentials must configure ATProto OAuth/client metadata before creator sign-in works after this change.

## Capabilities

### New Capabilities

### Modified Capabilities
- `creator-auth`: creator authentication switches from Google OAuth profile initialization to ATProto OAuth/PDS identity and profile initialization.

## Impact

- Auth configuration in `lib/auth.ts` and the NextAuth provider setup.
- Sign-in UI components and localized auth/profile copy.
- User profile synchronization in `lib/users.ts`.
- Deployment/development documentation and environment variable guidance.
- Unit coverage for ATProto profile synchronization and provider callback behavior where feasible.
