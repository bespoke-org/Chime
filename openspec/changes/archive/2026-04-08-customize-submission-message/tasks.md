## 1. Data model and validation

- [x] 1.1 Add completion title, message, link label, and link URL fields to the `Form` model and create a Prisma migration
- [x] 1.2 Extend form metadata validation to accept completion content and reject incomplete or invalid follow-up link data
- [x] 1.3 Update form serialization and update logic so builder and public form payloads include the new completion settings

## 2. Builder settings support

- [x] 2.1 Add completion content inputs to the builder form settings panel
- [x] 2.2 Populate the new builder inputs from existing form metadata and persist them through the existing save settings action
- [x] 2.3 Verify builder behavior for default values, empty CTA fields, and validation feedback

## 3. Public runner completion state

- [x] 3.1 Update the public form runner to render saved completion title and message after successful submission
- [x] 3.2 Render the optional follow-up link only when both CTA label and URL are available
- [x] 3.3 Preserve fallback completion copy for forms without customized completion settings

## 4. Verification

- [x] 4.1 Test that existing forms still submit successfully and show a valid completion state
- [x] 4.2 Run build and relevant checks to confirm the new metadata flow works end-to-end
