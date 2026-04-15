## Context

The public form runner currently models navigation as a visited-route history plus a cursor. That supports branching, respondent backtracking, and resumed sessions, but it assumes every published form allows backward movement. Form settings already persist respondent-facing runner options such as progress visibility and interface locale, so a new navigation-control setting fits the same metadata path. Because this change touches persisted form data, creator settings UI, public runner behavior, and draft restore semantics, a short design is useful before implementation.

## Goals / Non-Goals

**Goals:**
- Let creators decide per form whether respondents may navigate back to earlier visited steps.
- Preserve the existing experience for all current forms by defaulting to back navigation enabled.
- Enforce the setting consistently in the live runner and after saved-progress restoration.
- Keep the implementation aligned with existing form metadata storage, validation, and serialization patterns.

**Non-Goals:**
- Introducing per-block or conditional navigation locks.
- Preventing browser-level page refresh/close/navigation outside the runner UI itself.
- Reworking branching, submission validation, or progress calculations beyond the changes needed to respect the new setting.
- Adding new respondent roles, authentication, or anti-tampering guarantees beyond existing public runner behavior.

## Decisions

### 1. Store back-navigation control as a persisted form-level boolean
The system will add a boolean form field such as `allowBackNavigation` with a default of `true`, and include it in builder/public form payloads plus form metadata validation.

**Why:** This setting is authored form behavior, similar to `showProgress` and `respondentLocale`, and must survive draft saves, publication, and later edits.

**Alternatives considered:**
- Keep the value only in client state: rejected because respondent behavior must follow the saved form, not the current creator session.
- Encode the behavior indirectly from branching rules or block settings: rejected because the request is a simple form-wide navigation policy.

### 2. Expose the control in form settings next to other respondent-experience options
The builder will surface the option in the form settings panel alongside respondent language and progress visibility, using clear copy that explains the setting applies to respondents in the public runner.

**Why:** Creators already manage runner-wide presentation and behavior in this panel, so adding one more runner-level control keeps discovery and mental model simple.

**Alternatives considered:**
- Add a separate advanced settings area: rejected because the feature is straightforward and would be harder to find.
- Put the option on each block: rejected because the requested behavior is form-wide, not per-step.

### 3. Enforce the rule at the runner action layer, not only in the UI
When `allowBackNavigation` is false, the public runner will not render the back action and will also guard any back-navigation code paths so route state cannot move backward through helper calls or keyboard handling.

**Why:** UI hiding alone is fragile. Central action-level enforcement keeps behavior correct if the component grows more navigation triggers later.

**Alternatives considered:**
- Hide only the back button: rejected because future shortcuts or internal calls could accidentally bypass the setting.
- Rebuild the route model without a cursor/history concept: rejected because the current route model still works for forward progression and restore validation.

### 4. Keep saved-progress restoration compatible and honor the current form setting on resume
Stored drafts do not need to persist a separate copy of the back-navigation flag. On restore, the runner can continue restoring answers/history/cursor as it does today, but resumed interaction must use the current form setting to decide whether backward movement is available.

**Why:** The restored state describes where the respondent is, while the form setting describes what navigation actions are currently allowed. This avoids invalidating saved progress just because the creator toggled the setting.

**Alternatives considered:**
- Include the flag in the draft fingerprint and invalidate drafts whenever it changes: rejected because restoring current position is still safe and less disruptive.
- Force-collapsing restored history when back navigation is disabled: rejected because forward flow and progress calculations still benefit from the visited route.

## Risks / Trade-offs

- [Creators may expect the setting to prevent all browser back behavior] → Mitigation: scope copy and specs to runner back navigation within the form UI, not global browser history control.
- [Hidden UI without logic guards could regress later] → Mitigation: centralize enforcement in the runner navigation handler/helper path and cover it with tests.
- [Existing forms could change behavior unexpectedly] → Mitigation: default the stored field to `true` and treat missing legacy values as enabled.
- [Restored sessions might feel inconsistent if creators change the setting mid-response] → Mitigation: honor the latest saved form behavior while still restoring the respondent's current step and answers.

## Migration Plan

- Add a new boolean column on `Form` with default `true`.
- Thread the field through form loading, builder serialization, and metadata validation.
- Update the builder settings save flow to persist the value.
- Update public runner rendering and tests to respect the flag.
- Rollback is low risk: the code can ignore the field and default behavior remains equivalent to enabled back navigation.

## Open Questions

- None currently. The requested behavior is clear enough to implement as a form-level boolean with a default-enabled migration.
