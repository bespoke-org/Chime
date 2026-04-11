## Why

Creators currently can only collect free text and choice-based answers. To support more practical workflows, the form builder needs additional question types for structured values such as numbers, links, dates, and explicit consent.

## What Changes

- Add a number question block that accepts numeric answers, with optional controls for allowing floats and setting minimum/maximum values.
- Add a link question block that accepts only valid link values.
- Add an agreement block that allows only agreed / not agreed responses and treats `agreed` as required when the block is marked required.
- Add a date question block that accepts date answers.
- Add optional custom regex validation to text-answer blocks so creators can constrain accepted text formats.
- Extend builder editing, public runner validation, saved responses, and related creator surfaces to support the new block types and regex-validated text answers consistently.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conversational-form-builder`: expand the set of supported block types and add optional regex validation configuration for text-answer blocks in the builder.
- `anonymous-form-runner`: validate and submit number, link, agreement, and date answers, plus regex-validated text answers, in the public runner.

## Impact

- Affected code: form builder UI, block type definitions, block validation, public form runner, response persistence, localized labels, and response review/export formatting.
- APIs/data: block creation and update flows will need to accept the new block kinds, numeric constraints, regex configuration for text-answer blocks, and the resulting answer shapes.
- Dependencies: no new dependency expected unless native input handling proves insufficient.
