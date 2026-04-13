## Why

Form authors currently have only plain text for question descriptions and text blocks, which makes it hard to add light emphasis, inline code, links, and readable structure without over-designing the UI. Adding a small, well-defined Markdown subset improves clarity for respondents while keeping authored content safe, simple, and predictable.

## What Changes

- Add support for a basic Markdown subset in author-written form content, specifically question descriptions and text block bodies.
- Render the supported Markdown consistently in the public runner and creator response review surfaces where the same authored content is shown.
- Limit supported formatting to lightweight constructs: italic, bold, inline code, links, lists, and section-style headings.
- Keep respondent-submitted short and long text answers as plain text in review screens for this change.
- Preserve existing plain-text content behavior so forms without Markdown continue to render normally.

## Capabilities

### New Capabilities
- `markdown-form-content`: Safe rendering rules for basic Markdown in author-written form content.

### Modified Capabilities
- `anonymous-form-runner`: Author-written descriptions and text content shown to respondents must render the supported Markdown subset.
- `response-review`: Author-written descriptions and text content shown in creator review views must render the supported Markdown subset consistently.

## Impact

- Affected code: public runner rendering, response review/detail rendering, form builder settings/help text, shared content rendering utilities, validation or sanitization helpers.
- Data model: no new persisted content fields are required because existing description/body fields already store plain strings.
- Dependencies: may require a lightweight Markdown parser/sanitizer or a constrained in-house renderer.
- Security: rendered Markdown must be sanitized and limited to the approved subset to avoid unsafe HTML injection.
