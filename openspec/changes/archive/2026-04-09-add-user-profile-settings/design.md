## Context

The product already has authenticated creator settings, organization management, workspace switching, and a creator navbar, but it does not have a dedicated user-profile surface. The `User` model already contains `firstName`, `secondName`, and `image` fields, while the current session payload only exposes `id` and the current creator shell still uses a separate sign-out button instead of an avatar-triggered account menu.

This change crosses several parts of the app: settings information architecture, auth/session shaping, navbar UI, and organization member rendering. It also needs a consistent rule for how Google OAuth data interacts with user-managed profile data.

## Goals / Non-Goals

**Goals:**
- Add a Profile section to settings where a signed-in user can edit first name, second name, and profile image.
- Reuse Google profile data to seed identity fields, especially the profile image, when a user first signs in or when stored values are still missing.
- Show the current user avatar in the creator navbar and use it as the trigger for an account menu with Settings and Log out actions.
- Show organization member avatars in member lists using the same shared avatar behavior.
- Keep the implementation aligned with the existing flatter settings and creator-shell UI.

**Non-Goals:**
- Public profile pages or profile discovery outside authenticated creator surfaces.
- Rich profile editing beyond first name, second name, and profile image.
- A full social/account-management system.
- A large standalone media-management subsystem.

## Decisions

### 1. Reuse the existing `User.firstName`, `User.secondName`, and `User.image` fields
The schema already contains the profile fields needed for this feature, so the implementation should build on them instead of introducing a parallel profile table.

**Why:** This keeps the change small, avoids unnecessary migrations, and matches how NextAuth already relates identity data to the `User` record.

**Alternative considered:** Add a separate `UserProfile` model. Rejected because the required data is already present and the additional relation would add complexity without clear product benefit.

### 2. Treat Google profile data as an initializer, not a permanent source of truth
Google OAuth should populate missing user-facing identity fields when available, especially the avatar image, but it should not overwrite fields that the user has already edited in settings.

**Why:** The user explicitly wants Google to fetch the profile image initially, but profile settings should remain user-controlled after that. Preserving manual edits avoids a frustrating loop where every login resets the profile.

**Alternative considered:** Always overwrite names and image from Google on sign-in. Rejected because it would conflict with editable profile settings.

### 3. Store the canonical profile picture as a URL in `User.image`
The avatar shown in the navbar, settings preview, and organization member lists should come from `User.image`, regardless of whether it originated from Google or a later user update.

**Why:** The app already has a standard place for identity images, and all avatar surfaces can render from the same field.

**Alternative considered:** Separate `googleImage` and `customImage` fields. Rejected for v1 because it adds branching behavior without a strong product need.

### 4. Keep profile image editing simple in v1
The first implementation should update the profile image through the existing application data flow and keep the stored result as a URL in `User.image`. If direct binary upload infrastructure is not already available, the settings UI can still be implemented around setting or replacing the stored image URL rather than introducing a new storage system during this change.

**Why:** The requested user value is profile presence across the product, not a full file-storage architecture. This keeps the change implementable inside the current stack.

**Alternative considered:** Introduce a new upload/storage provider as part of this change. Deferred because it expands scope and deployment complexity.

### 5. Introduce a shared avatar/display-name primitive for creator surfaces
The navbar and organization member list should use the same avatar component and display-name resolution logic. The fallback order should be: profile image → initials from first/second name → initials from `name` → email-derived fallback.

**Why:** This keeps avatar behavior consistent and avoids duplicate formatting logic.

**Alternative considered:** Handle avatar rendering independently in each surface. Rejected because it would drift quickly and complicate maintenance.

### 6. Replace the standalone navbar sign-out button with an avatar-triggered account menu
The current creator shell should use the user avatar at the right side of the navbar as the account entry point. The menu should contain Settings and Log out, keeping workspace switching separate.

**Why:** This matches the requested interaction model and reduces header clutter while preserving a fast path to settings and sign-out.

**Alternative considered:** Keep the separate sign-out button and add another profile button. Rejected because it adds more chrome instead of simplifying the shell.

## Risks / Trade-offs

- **[Profile image management stays URL-based in v1]** → Mitigation: keep the profile-image logic isolated so a later upload backend can replace the input mechanism without changing avatar consumers.
- **[Google provider payloads can vary in available name/image fields]** → Mitigation: populate only when values are present and keep robust avatar/name fallbacks.
- **[Session payload expansion can create stale display state if not refreshed]** → Mitigation: refresh the creator shell after profile updates and keep critical data sourced from the server-rendered session path.
- **[Navbar menu changes can affect creator-shell spacing and discoverability]** → Mitigation: keep the avatar trigger compact and preserve clear Settings access in the menu.
- **[Organization member rows can become visually crowded]** → Mitigation: use a small shared avatar size and preserve the current compact row layout.
