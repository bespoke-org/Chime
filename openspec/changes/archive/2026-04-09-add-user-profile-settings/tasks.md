## 1. Profile data and auth shaping

- [x] 1.1 Update authenticated session and user-loading paths so creator surfaces can access first name, second name, and profile image data.
- [x] 1.2 Add or refine Google sign-in synchronization so missing profile fields are initialized from Google without overwriting creator-managed values.
- [x] 1.3 Add shared helpers for resolving display name, avatar image, and fallback initials from user identity data.

## 2. Profile settings experience

- [x] 2.1 Add a Profile section to the settings shell alongside the existing settings areas.
- [x] 2.2 Implement profile settings UI for editing first name and second name.
- [x] 2.3 Implement profile image management UI and persistence using the canonical user image field.
- [x] 2.4 Ensure profile updates refresh the current creator experience cleanly after save.

## 3. Creator shell account surfaces

- [x] 3.1 Replace the standalone navbar sign-out button with an avatar trigger on the right side of the creator navbar.
- [x] 3.2 Implement the avatar account menu with Settings and Log out actions.
- [x] 3.3 Ensure the navbar avatar uses the current profile image or a consistent fallback treatment.

## 4. Organization member identity display

- [x] 4.1 Extend organization member data loading to include profile image and profile-name fields needed for display.
- [x] 4.2 Update the organization members list UI to show member avatars alongside name and email information.
- [x] 4.3 Reuse the shared avatar and display-name behavior in organization member rows.

## 5. Verification

- [x] 5.1 Verify a new or incomplete Google-backed user gets an initial profile image and available name data.
- [x] 5.2 Verify manual profile edits persist and are not overwritten by later Google sign-ins.
- [x] 5.3 Verify the navbar avatar menu, settings navigation, and log out flow work correctly.
- [x] 5.4 Verify organization member lists show avatars and correct fallbacks.
- [x] 5.5 Run the production build and fix any type or layout issues introduced by the change.
