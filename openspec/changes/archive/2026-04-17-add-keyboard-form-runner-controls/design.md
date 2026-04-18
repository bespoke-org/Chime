## Context

The public runner already has a partial keyboard model in `components/public-form-runner.tsx`: a window-level `Enter` handler advances the current step, `Escape` moves back when back navigation is enabled, and typed-answer fields call the same advance helper on `Enter`. Choice options are rendered as buttons with their own `onKeyDown` behavior, so a focused choice button can still treat `Enter` as an activation event instead of a pure advance command. The runner also does not currently autofocus the primary input when a new text-like question becomes active, and choice questions do not visibly advertise any keyboard shortcuts.

This change is limited to the respondent-facing public runner. It should not alter form data, branching semantics, creator-facing editing, or submission APIs. The builder already limits choice questions to at most 10 options, which makes a numeric shortcut model feasible without adding pagination or multi-key sequences.

## Goals / Non-Goals

**Goals:**
- Let respondents answer choice-based questions quickly with number keys in display order.
- Make keyboard shortcuts visible so the feature is discoverable.
- Focus the primary input automatically for typed-answer questions when a new step becomes active.
- Make `Enter` mean “continue/submit this step” without also toggling a focused choice option.
- Preserve existing validation, branching, pointer interactions, and back-navigation behavior.

**Non-Goals:**
- Redesign the visual layout of the public runner.
- Add new block types or creator-facing settings for keyboard behavior.
- Change submission payloads, persistence format, or server-side APIs.
- Introduce complex shortcut schemes beyond the current visible step, such as arrow-key roving focus across the whole form.

## Decisions

### 1. Add a runner-scoped numeric shortcut layer for choice-style questions
For `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, and `AGREEMENT` steps, the runner should listen for unmodified digit key presses when the respondent is not typing in an input-like control. The shortcut mapping should follow visible option order: `1` through `9`, with `0` mapped to the tenth visible option when present. Single-choice and agreement shortcuts replace the current answer; multiple-choice shortcuts toggle the targeted option in place.

**Why this approach:**
- Matches the user's requested `123456...` flow.
- Fits the builder's existing 10-option cap.
- Keeps keyboard selection aligned with what the respondent currently sees on screen.

**Alternatives considered:**
- Letter shortcuts derived from option text: rejected because labels can repeat, localize differently, or begin with non-Latin characters.
- Arrow-key navigation only: rejected because it is slower for direct selection and does not match the requested behavior.

### 2. Show shortcut affordances directly on option rows
Choice-style options should render a small numeric badge or similar inline affordance for their shortcut key, plus lightweight helper copy near the question that tells respondents they can use number keys. Agreement blocks should use the same pattern for consistency even when there is only one actionable option. These shortcut badges and hints should remain visible on mobile layouts as well, not only at tablet/desktop breakpoints.

**Why this approach:**
- Makes the feature discoverable instead of hidden.
- Avoids requiring respondents to guess whether shortcuts exist.
- Keeps the hint localized and reusable across question types.
- Preserves the same discoverability on touch devices, where respondents may still use external keyboards or benefit from understanding the numbered mapping.

**Alternatives considered:**
- No visible hint: rejected because hidden shortcuts have low product value.
- A one-time global keyboard tutorial: rejected because respondents may enter mid-flow or ignore dismissible help.

### 3. Centralize `Enter` as an advance action and suppress native choice-button activation
The runner should treat plain `Enter` as a continue/submit command for the active step when validation passes. To avoid the current bug on choice steps, focused option buttons must not interpret `Enter` as a toggle/select action. Pointer clicks remain unchanged, and keyboard selection for choice questions moves to digit shortcuts. If the product still needs a direct keyboard activation on focused choice buttons, that should use a non-conflicting key such as Space rather than Enter.

**Why this approach:**
- Directly fixes the reported bug where `Enter` both changes a choice and advances.
- Preserves a simple mental model: `Enter` advances, digits answer.
- Avoids split behavior where Enter means different things depending on which option currently has focus.

**Alternatives considered:**
- Keep Enter toggling focused options and remove global advance: rejected because it slows down step progression and conflicts with the user's request.
- Blur focused buttons before continuing: rejected because it is brittle and still relies on native button activation timing.

### 4. Autofocus the primary typed input on active step changes
For short text, long text, number, link, and date questions, the runner should keep a ref to the primary input control and focus it when that block becomes the active step after mount, route advance, or route restoration. Focus should run only after the active step is rendered and should avoid stealing focus during submission or completion.

**Why this approach:**
- Reduces friction for keyboard-first respondents.
- Matches the requested “input field focused by default” behavior.
- Works cleanly with the existing one-step-at-a-time runner model.

**Alternatives considered:**
- Rely on browser autofill/autofocus attributes alone: rejected because the active block is replaced dynamically and needs controlled focus on each step change.
- Focus the card container instead of the input: rejected because it still requires an extra keystroke before typing.

### 5. Preserve multiline authoring with `Shift+Enter` while keeping plain `Enter` for progression
For long-text questions, plain `Enter` should advance to the next step just like other input questions, while `Shift+Enter` may continue inserting a newline. This keeps the product's “Enter continues” rule intact without fully removing multiline entry.

**Why this approach:**
- Respects the user's request that Enter advances.
- Avoids regressing long-text questions into effectively single-line fields.
- Minimizes behavior changes because the current code already distinguishes `Shift+Enter`.

**Alternatives considered:**
- Make Enter always insert a newline in long text: rejected because it breaks the requested keyboard progression model.
- Remove multiline entry entirely: rejected because it harms legitimate long-answer use cases.

## Risks / Trade-offs

- **Shortcut collisions with browser or assistive-technology commands** → Ignore modified key combinations and scope numeric shortcuts only to the active runner step when no text input is being edited.
- **The `0` mapping for a tenth option may be less obvious than `1`-`9`** → Show the visible key badge on the option itself so the mapping is explicit on both desktop and mobile.
- **Suppressing Enter on focused choice buttons can surprise users who expect default button semantics** → Keep the continue affordance visible, make digit shortcuts prominent, and allow pointer clicks to behave normally.
- **Autofocus can feel jumpy if applied too aggressively during animation** → Focus only after the active block changes and skip focus moves during submission/completion states.

## Migration Plan

1. Add localized public-runner hint strings for numeric shortcuts and any related keycap labels.
2. Refactor `components/public-form-runner.tsx` so active-step keyboard handling is centralized around the current block type.
3. Add refs and active-step focus effects for text-like inputs and the date picker trigger/input.
4. Update choice option rendering to show shortcut badges on both desktop and mobile and remove Enter-driven toggle behavior.
5. Verify keyboard flows for single choice, multiple choice, agreement, text-like inputs, back navigation, and final submission.

Rollback strategy:
- Revert the runner keyboard/focus changes and localized hint copy. No persisted data or schema rollback is required.

## Open Questions

- Should agreement blocks also advertise a numeric shortcut when there is only one visible action, or is consistent badge treatment enough?
- Do we want a future creator setting to disable visible shortcut hints for highly customized branded forms?