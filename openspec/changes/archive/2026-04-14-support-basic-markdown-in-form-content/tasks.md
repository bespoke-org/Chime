## 1. Markdown rendering foundation

- [x] 1.1 Choose and add the safe Markdown parsing/rendering dependency or shared implementation for the approved subset.
- [x] 1.2 Build a shared authored-content Markdown renderer that disables raw HTML and restricts rendered output to the approved elements.
- [x] 1.3 Add shared link-safety handling so only safe `http` and `https` links render as interactive anchors.

## 2. Public and creator surface adoption

- [x] 2.1 Update the public runner to render question descriptions and text block bodies with the shared authored Markdown renderer.
- [x] 2.2 Update creator response detail and question-centric review surfaces to render authored descriptions and text block bodies with the same renderer.
- [x] 2.3 Keep respondent-submitted short-text and long-text answers rendered as plain text in review surfaces.

## 3. Authoring guidance and validation

- [x] 3.1 Add concise builder help text that explains the supported Markdown subset for author-written descriptions and text content.
- [x] 3.2 Ensure unsupported or unsafe authored content degrades safely without executing HTML or unsafe links.

## 4. Verification

- [x] 4.1 Add or update tests covering supported formatting, plain-text compatibility, and unsafe content handling.
- [x] 4.2 Verify formatted authored content renders consistently in the runner and creator review views.
- [x] 4.3 Run the production build and fix any type, styling, or rendering issues introduced by the change.
