## 1. Persist form-level back-navigation settings

- [x] 1.1 Add a persisted `allowBackNavigation` form field with a default-enabled migration for existing and new forms
- [x] 1.2 Thread `allowBackNavigation` through form metadata validation, form serialization, and builder/public form TypeScript types
- [x] 1.3 Add or update validation tests to confirm the setting defaults to `true` and preserves explicit disabled values

## 2. Expose the setting in creator form settings

- [x] 2.1 Extend the form settings draft/save flow so creators can edit and persist the respondent back-navigation option
- [x] 2.2 Update the form settings panel UI and localized copy to explain the option alongside other respondent-experience controls
- [x] 2.3 Add builder UI tests covering default enabled behavior, disabling the setting, and reopening settings with a saved disabled value

## 3. Enforce the setting in the public form runner

- [x] 3.1 Update public runner navigation logic to block backward route movement when `allowBackNavigation` is false while preserving forward progression, validation, and branching
- [x] 3.2 Update the runner UI so back navigation controls are only shown when the form allows them
- [x] 3.3 Add runner state/component tests covering enabled back navigation, disabled back navigation, and branching after forward-only progression

## 4. Honor the setting during saved-progress restore

- [x] 4.1 Ensure restored runner sessions continue from the saved step while honoring the form's current `allowBackNavigation` mode
- [x] 4.2 Add restore-focused tests proving resumed sessions do not expose backward navigation when the setting is disabled and still allow it when enabled
