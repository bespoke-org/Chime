## 1. Locale model and translation infrastructure

- [x] 1.1 Add persisted locale support for users and shared locale normalization helpers with `en`/`ru` support and English fallback.
- [x] 1.2 Add YAML-backed translation resources for English and Russian with a mirrored key structure.
- [x] 1.3 Implement shared translation-loading and label-resolution utilities for server/client app surfaces.
- [x] 1.4 Add build-time translation validation that warns with missing labels for incomplete locale files.

## 2. Auth and profile locale behavior

- [x] 2.1 Update Google sign-in synchronization to initialize a missing user locale from OAuth when supported and default to English otherwise.
- [x] 2.2 Expose the resolved locale through authenticated session and user-loading paths needed by the app.
- [x] 2.3 Extend Profile settings so a signed-in user can view and update their locale preference.

## 3. UI text migration

- [x] 3.1 Replace inline strings on core creator shell and settings surfaces with translation labels.
- [x] 3.2 Replace inline strings on shared/public surfaces needed for the current product experience with translation labels.
- [x] 3.3 Ensure translation lookup is used consistently instead of introducing new hardcoded UI copy.

## 4. Locale application flow

- [x] 4.1 Apply the active locale during app rendering so supported users see English or Russian copy consistently.
- [x] 4.2 Use browser locale for unauthenticated/public usage when it is supported.
- [x] 4.3 Ensure unsupported detected locales resolve to English without breaking rendering.
- [x] 4.4 Ensure profile locale changes take effect cleanly in subsequent creator usage.

## 5. Verification

- [x] 5.1 Verify a Google-backed user with a supported OAuth locale is initialized into that locale.
- [x] 5.2 Verify unsupported OAuth locales fall back to English.
- [x] 5.3 Verify unauthenticated/public usage follows supported browser locale and falls back to English otherwise.
- [x] 5.4 Verify Profile settings can switch between English and Russian and persist the preference.
- [x] 5.5 Verify labeled strings render from YAML resources across creator and public surfaces covered by the change.
- [x] 5.6 Verify the build warns with missing translation labels when a locale file is incomplete.
- [x] 5.7 Run the production build and fix any type or integration issues introduced by the localization system.
