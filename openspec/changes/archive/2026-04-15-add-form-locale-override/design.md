## Context

Public form routes currently render localized interface strings from the active request locale, which is derived from supported browser or user-preference signals and then normalized to a supported language. That keeps general localization simple, but it does not give creators a way to keep a specific form's respondent-facing interface aligned with the language of the form content itself. This change crosses creator settings, stored form metadata, public-form loading, and locale resolution, so a short design is useful before implementation.

## Goals / Non-Goals

**Goals:**
- Let a creator choose a respondent interface locale override per form.
- Preserve existing visitor-language detection when no override is configured.
- Keep locale handling limited to the existing supported locales and fallback-to-English behavior.
- Make the public runner, validation copy, progress labels, and completion state honor the saved override consistently.

**Non-Goals:**
- Auto-translating form content authored by creators.
- Adding new supported languages in this change.
- Introducing per-block or per-section locale settings.
- Changing creator-dashboard locale behavior outside the form settings needed to edit the override.

## Decisions

### 1. Store locale override as form metadata, not as a transient request preference
The system will persist a nullable form-level locale override alongside other form settings. `null` means the `Use visitor's language` mode; a supported locale value such as `en` or `ru` means the public runner must use that locale for respondent-facing UI.

**Why:** The override is part of the form's authored behavior, similar to title, completion content, and slug. It must survive draft saves, publication, and later edits.

**Alternatives considered:**
- Store override only in published snapshots: rejected because creators need to preview and edit draft behavior.
- Store override in browser local state: rejected because the setting belongs to the form, not the current creator session.

### 2. Apply the override only on public respondent-facing form surfaces
The override will affect public form routes and the locale used to prepare public runner strings. Creator-facing builder chrome will continue to follow the creator/session locale.

**Why:** The problem is respondent experience mismatch, not creator workspace localization. Keeping creator surfaces on their own locale avoids surprising workspace-wide language switches while editing a form.

**Alternatives considered:**
- Also force the builder locale while editing that form: rejected because it would couple one form's language to the whole creator session and make mixed-language workspaces harder to use.

### 3. Resolve locale with clear precedence: form override first, then existing detection, then fallback
For public forms, locale resolution will first check the saved form override. If absent, the system will continue using the current supported-locale detection flow. Unsupported or malformed values will still normalize to English.

**Why:** This preserves the existing localization model while adding one explicit author-controlled override point.

**Alternatives considered:**
- Let browser locale override the form setting: rejected because it does not solve the reported inconsistency.
- Remove browser locale detection entirely: rejected because visitor-language localization remains desirable for forms without an override.

### 4. Keep the saved value constrained to supported locales
The builder setting and persistence layer will only allow `null`, `en`, or `ru` initially.

**Why:** The app already validates locale support centrally. Reusing that contract keeps runtime behavior predictable and avoids publishing forms with unusable locale values.

**Alternatives considered:**
- Allow arbitrary BCP-47 locale codes for future-proofing: rejected because the application only ships `en` and `ru` resources today.

## Risks / Trade-offs

- [Creators may expect form content itself to be translated] → Mitigation: label the setting as interface language for respondent UI, not content translation.
- [Existing public-form locale loading may have multiple entry points] → Mitigation: centralize override-aware resolution in the shared public-form loading/i18n path instead of duplicating precedence logic.
- [Stored invalid values from manual edits or future bugs could break rendering] → Mitigation: normalize persisted locale override through the existing supported-locale fallback helper.
- [Previewing draft behavior may differ from published behavior if override is not included in all serialization paths] → Mitigation: update both creator draft payloads and public form payload generation to carry the same field.

## Migration Plan

- Add a nullable persisted locale override field or config value with default `null` for existing forms.
- Treat missing values on existing records as `Use visitor's language`.
- Rollback is low risk: code can ignore the field and continue using current locale detection, with existing saved `null`/supported values remaining harmless.

## Open Questions

- None currently. The product intent is clear enough to proceed with a form-level override using existing supported locales.
