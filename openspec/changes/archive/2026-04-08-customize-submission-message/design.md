## Context

The public runner currently ends with a fixed completion state embedded in `components/public-form-runner.tsx`. Creators cannot tailor that final screen to explain what happens next or direct respondents to another destination.

This change touches both creator-facing and respondent-facing flows. Form metadata already lives on the `Form` record and is edited through the builder settings panel, so the completion state should follow the same pattern rather than introducing a separate entity.

## Goals / Non-Goals

**Goals:**
- Let creators configure the completion text shown after a successful submission.
- Let creators optionally provide a follow-up link that appears on the completion state.
- Preserve a safe default completion state for older forms and forms with no custom content.
- Keep the implementation aligned with the existing form metadata update flow.

**Non-Goals:**
- Rich text editing for completion content.
- Per-response or conditional completion messages.
- Multiple follow-up links or button styling customization.
- Tracking follow-up link clicks.

## Decisions

### Store completion content directly on the `Form` model
Add dedicated form-level fields for completion content instead of a JSON blob or separate table. This keeps the feature easy to validate, serialize, and expose through existing builder/public form payloads.

Proposed fields:
- `completionTitle`: short heading shown after submission
- `completionMessage`: supporting copy shown below the heading
- `completionLinkLabel`: optional CTA label
- `completionLinkUrl`: optional CTA URL

**Why this approach:**
- Fits the existing form metadata model.
- Avoids schema ambiguity and ad hoc JSON validation.
- Makes default values and future migrations straightforward.

**Alternatives considered:**
- Store completion settings in a JSON column on `Form`: more flexible, but weaker typing and more validation complexity.
- Hardcode only a single customizable message string: simpler, but too limiting for the requested “next action + link” use case.

### Extend existing metadata update validation and API
The builder already updates title, description, and slug via the form metadata flow. Completion fields should be added to the same schema and persistence path.

**Why this approach:**
- One save action for all form-level settings.
- No new endpoint or settings surface is required.
- Keeps builder behavior predictable for creators.

**Alternatives considered:**
- Separate completion-settings endpoint: unnecessary complexity for a small metadata extension.

### Treat the follow-up link as optional and only render it when complete
The runner should show the CTA only when both label and URL are present and valid enough to save. Partial CTA input should not render a broken link.

**Why this approach:**
- Prevents incomplete UI states.
- Matches the user request without forcing every form to include a CTA.

**Alternatives considered:**
- Render when only a URL exists: creates unclear CTA text.
- Require a link for all forms: too restrictive.

### Keep fallback completion copy for existing forms
Older forms should continue to show a coherent completion state even before creators edit the new settings.

**Why this approach:**
- Avoids a migration that would require backfilling handcrafted content for every form.
- Preserves the current experience while allowing progressive customization.

**Alternatives considered:**
- Make new fields required with no defaults: risks blank or broken completion screens for existing forms.

## Risks / Trade-offs

- **More fields on `Form`** → Mitigation: use a small, explicit set of fields rather than a generalized content system.
- **Invalid or unsafe link input** → Mitigation: validate URLs on save and render only complete CTA data.
- **Long completion copy can overflow the current finish screen design** → Mitigation: keep inputs plain text, provide reasonable validation limits, and reuse the responsive card layout already used by the completion state.
- **Migration introduces schema drift if not applied everywhere** → Mitigation: add a Prisma migration and ensure builder/public serializers read the new fields.

## Migration Plan

1. Add new completion fields to the Prisma `Form` model.
2. Generate and apply a migration with safe defaults or nullable link fields.
3. Extend form metadata validation, serialization, and update logic.
4. Add builder settings inputs for completion title, completion message, and optional link label/URL.
5. Update the public runner completion state to use saved form data with fallback defaults.
6. Verify existing forms still submit successfully and display a valid completion state.

## Open Questions

- Should the CTA open in a new tab by default for external URLs?
- Do we want URL validation to allow relative links, or only absolute `http/https` URLs?
- Should the completion title/message have stricter length limits for better visual consistency?
