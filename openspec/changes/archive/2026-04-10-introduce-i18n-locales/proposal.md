## Why

The product currently hardcodes interface strings directly in code, which makes it difficult to support multiple languages and keep text consistent across creator and public experiences. Adding a real i18n system now will let the app support English and Russian immediately while creating a maintainable path for future languages.

## What Changes

- Introduce an application-wide i18n system that resolves UI copy from per-language YAML files instead of inline strings in code.
- Add locale support for English and Russian, with English as the fallback when a detected locale is not supported.
- Use the browser locale for unauthenticated respondents and other non-logged-in app usage, still falling back to English when unsupported.
- Initialize a user’s locale from Google OAuth data when possible during sign-in.
- Allow authenticated users to change their locale later from Profile settings.
- Apply localized copy consistently across creator surfaces, shared UI, and public-facing flows covered by the new localization system.

## Capabilities

### New Capabilities
- `site-localization`: load labeled strings from language-specific YAML resources, resolve supported locales, and provide fallback behavior across app surfaces

### Modified Capabilities
- `creator-auth`: authenticated identity initialization should derive a supported locale from OAuth when available and fall back to English otherwise
- `creator-profile-settings`: profile settings should allow a signed-in user to view and update their language preference

## Impact

- Affected code: shared UI text rendering, settings/profile UI, auth/session shaping, locale resolution helpers, and app/page-level text access
- Affected systems: Google OAuth profile ingestion, user preference persistence, server/client translation loading
- Potential dependencies: YAML parsing support, a shared translation-loading layer, and build-time translation validation/warning support
