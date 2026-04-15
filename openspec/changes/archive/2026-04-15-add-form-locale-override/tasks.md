## 1. Form metadata and persistence

- [x] 1.1 Add a nullable respondent interface locale override field to form metadata/domain types with supported-locale validation and `Use visitor's language` as the no-override/default mode.
- [x] 1.2 Include the locale override in form settings load/save flows and any form serialization used by the builder.
- [x] 1.3 Add or update tests covering persisted form locale override normalization and round-tripping.

## 2. Creator settings UI

- [x] 2.1 Add a form settings control that lets creators choose `Use visitor's language` or a supported explicit respondent interface locale.
- [x] 2.2 Ensure the builder restores the saved selection when reopening form settings and persists changes through the existing save action.
- [x] 2.3 Add UI tests covering selecting, saving, and reloading the form locale override.

## 3. Public locale resolution

- [x] 3.1 Update public form loading/i18n resolution so a saved form locale override takes precedence over automatic locale detection on respondent-facing routes.
- [x] 3.2 Ensure public runner strings, validation copy, progress text, and completion UI all read from the resolved override-aware locale.
- [x] 3.3 Add tests covering explicit override precedence, `Use visitor's language` fallback behavior, and unsupported-value fallback to English.
