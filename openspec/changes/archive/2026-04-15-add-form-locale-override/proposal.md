## Why

Public form runners currently localize respondent-facing interface strings from browser or system locale. That can produce a mixed-language experience when a creator builds a form in one language but the respondent's device prefers another, especially for labels such as navigation, validation, progress, and completion UI. Adding a per-form locale override makes respondent-facing copy consistent with the language the creator intends for that form.

## What Changes

- Add a form-level setting that lets creators choose whether a form's respondent-facing interface uses `Use visitor's language` or forces a specific supported locale.
- Persist the selected locale override as part of form metadata so draft and published forms keep the same respondent-language behavior.
- Apply the form-level locale override on public form routes so runner UI, validation messages, progress text, and completion-state interface strings render in the configured locale.
- Keep supported-locale fallback behavior intact so invalid or unsupported saved values resolve safely to English.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: creators can configure a per-form respondent interface locale override in form settings.
- `anonymous-form-runner`: public form routes resolve respondent-facing UI locale from the form override before using browser locale detection.
- `site-localization`: locale resolution supports a saved form-specific override for public form surfaces while preserving supported-locale fallback rules.

## Impact

- Affected code: creator form settings UI, form serialization and persistence, public form route loading, i18n locale resolution, and respondent runner rendering.
- APIs: form metadata payloads and public form data loading will include the saved locale override.
- Data model: forms need a persisted locale override field or equivalent config value.
- Dependencies: no new external dependencies expected.
