## Context

The app currently renders UI copy from hardcoded strings spread across creator pages, shared components, and public flows. That makes it difficult to support multiple languages, keep text consistent, or let users control their preferred language over time.

This change is cross-cutting because it affects how strings are authored, loaded, and consumed across the app. It also touches authentication and profile settings because the initial locale should come from OAuth when possible, and users must be able to override that choice later.

## Goals / Non-Goals

**Goals:**
- Introduce a real i18n layer where application copy is stored in per-language YAML files and referenced from code by labels/keys.
- Support English and Russian initially.
- Resolve locale with a predictable fallback to English when the detected locale is unsupported.
- Use browser locale for unauthenticated/public usage when it is supported.
- Warn during build when translation labels are missing from a locale file.
- Initialize locale from OAuth profile data when available for a signed-in user.
- Allow the signed-in user to change locale later in Profile settings.
- Provide a reusable translation-loading API that works for creator, shared, and public surfaces.

**Non-Goals:**
- Automatic runtime machine translation.
- Full pluralization/ICU formatting support in v1 beyond what is needed for current UI copy.
- Shipping every existing string in the product in one large uncontrolled rewrite without structure.
- Locale-specific routing such as `/ru/...` paths in v1.

## Decisions

### 1. Use YAML resource files keyed by stable translation labels
Translations will live in language-specific YAML files, with the same key structure across locales. Application code will reference labels/keys and resolve strings through a shared translation layer rather than embedding copy inline.

**Why:** This matches the requested authoring model, keeps text centralized, and makes future languages additive instead of requiring code rewrites.

**Alternative considered:** JSON dictionaries. Rejected because the user explicitly requested YAML-backed language files.

### 2. Start with a single shared locale model and English fallback
The supported locale set for v1 will be `en` and `ru`. Locale resolution will always normalize unknown or unsupported values to `en`.

**Why:** This gives predictable behavior and avoids partial unsupported-state bugs. English is also the safest default for currently existing copy.

**Alternative considered:** Preserve raw browser/provider locale even when unsupported. Rejected because it would produce ambiguous fallback behavior and make persistence harder to reason about.

### 3. Persist creator locale on the `User` record
Authenticated user locale should be stored as a user preference so the app can respect it consistently across sessions and devices. OAuth-derived locale should populate this field only when the stored preference is missing.

**Why:** The user explicitly wants locale to be changeable later in Profile settings, which makes it a persisted account preference rather than a transient client-only state.

**Alternative considered:** Store locale only in localStorage or cookies. Rejected because it would not follow the user across sessions/devices and would conflict with account-based preferences.

### 4. Resolve locale with a clear precedence order
For authenticated users, locale precedence should be: stored user locale → supported OAuth locale at initialization time only → `en`. For unauthenticated or public cases, the app should use browser locale detection when it resolves to a supported locale, otherwise `en`.

**Why:** This keeps user choice authoritative while still seeding a sensible initial locale from OAuth.

**Alternative considered:** Always prefer OAuth locale over stored preference. Rejected because it would override explicit user changes.

### 5. Add a small translation access layer instead of passing raw dictionaries everywhere
The app should expose shared helpers that load a locale dictionary and return a translator function or structured message accessor. Components should consume translated strings from those helpers rather than reading YAML directly.

**Why:** This localizes file-parsing and fallback behavior in one place and avoids duplicating lookup logic.

**Alternative considered:** Import YAML dictionaries directly in every component. Rejected because it couples components to storage format and makes fallback behavior inconsistent.

### 6. Add build-time translation validation with warnings for missing labels
The localization system should compare locale files against the default label set during build and emit warnings listing any missing translation labels instead of failing the build immediately.

**Why:** Missing translations should be visible early, but the initial rollout may be iterative. Warnings preserve momentum while still making gaps actionable.

**Alternative considered:** Hard-fail the build for any missing translation. Rejected for v1 because it is stricter than requested and could slow migration.

### 7. Roll out i18n by converting targeted surfaces first, but keep the architecture global
The initial implementation should localize the major creator/public/shared strings touched by the current app experience and establish the pattern for remaining strings. The important part of the change is that strings are sourced through labels and locale files, even if some cleanup continues later.

**Why:** Converting every string in one pass can be large, but the new architecture must be complete enough to carry the product going forward.

**Alternative considered:** Keep a mixed long-term model with many inline strings. Rejected because it undermines the goal of a real maintainable i18n system.

## Risks / Trade-offs

- **[Large copy migration surface]** → Mitigation: introduce a shared translation layer and convert strings systematically by area rather than ad hoc.
- **[YAML key drift between languages]** → Mitigation: keep a mirrored key structure and emit build-time warnings listing missing labels by locale.
- **[Auth/provider locale availability is inconsistent]** → Mitigation: normalize all provider input through a supported-locale helper and fall back to English.
- **[Server/client translation access can diverge]** → Mitigation: centralize dictionary loading and locale normalization helpers in shared utilities.
- **[Adding persisted locale may require a database migration]** → Mitigation: keep the field small and default-safe, and backfill existing users with `en` semantics through runtime normalization.

## Migration Plan

1. Add locale persistence to the user model and session shaping.
2. Introduce the translation resource structure and shared locale helpers.
3. Add English and Russian YAML files with mirrored keys.
4. Convert targeted UI surfaces from inline strings to translation keys.
5. Add locale selection to Profile settings and OAuth locale initialization.
6. Add build-time missing-translation warnings against the default locale labels.
7. Verify fallback behavior for unsupported locales, browser locale resolution for unauthenticated users, and existing users without a stored locale.

## Open Questions

- Whether the build-time warning mechanism should live in a dedicated validation script, a build hook, or an existing app check path.
