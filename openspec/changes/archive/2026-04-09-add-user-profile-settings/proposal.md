## Why

Creators need a basic profile surface inside settings so they can control how they appear across the product. Right now names are not editable from the UI, profile photos are not consistently sourced or shown, and the navbar account affordance does not provide a clear profile entry point.

## What Changes

- Add a Profile section in settings where a signed-in user can edit their first name and second name.
- Add profile image support so a user can keep the Google profile photo by default and later set or replace their own image.
- Show the user profile image in the creator navbar and use it as the trigger for an account menu with links to Settings and Log out.
- Show member profile images in organization member lists so workspace membership is easier to scan.
- Extend the authenticated user model and flows so Google OAuth initializes profile image data for new and returning users when available.

## Capabilities

### New Capabilities
- `creator-profile-settings`: manage creator profile fields and profile image from the authenticated settings experience

### Modified Capabilities
- `creator-auth`: authenticated identity data should include Google-sourced profile image data and avatar-based account access in creator surfaces
- `organizations`: organization member management should display member profile images alongside names and email information

## Impact

- Affected code: settings page and settings panels, creator layout/navbar, auth/session handling, organization settings UI, user persistence
- Affected systems: NextAuth Google provider mapping, user profile storage, creator navigation UI
- Potential dependencies: image upload/storage approach if custom profile images are stored outside the database directly
