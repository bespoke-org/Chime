## 1. Runner keyboard behavior

- [x] 1.1 Refactor `components/public-form-runner.tsx` to centralize active-step keyboard handling for Enter, Escape, and digit shortcuts by block type.
- [x] 1.2 Implement digit-key selection/toggling for single-choice, multiple-choice, and agreement steps using visible option order and preserving existing validation/branching behavior.
- [x] 1.3 Prevent Enter on focused choice controls from toggling an option so Enter only continues or submits when the current step is valid.

## 2. Focus and affordance updates

- [x] 2.1 Add active-step autofocus for short text, long text, number, link, and date questions without stealing focus during submission or completion.
- [x] 2.2 Update choice and agreement option rendering to show visible numeric shortcut badges and helper affordances for keyboard-driven answering, including on mobile layouts.
- [x] 2.3 Add or update localized public-runner strings needed for keyboard shortcut hints and any related key labels.

## 3. Verification

- [x] 3.1 Verify keyboard flows for single-choice, multiple-choice, and agreement questions, including number-key answering, visible mobile shortcut hints, and Enter-to-continue behavior.
- [x] 3.2 Verify autofocus and Enter behavior for short text, long text, number, link, and date questions, including multiline long-text handling.
- [x] 3.3 Add or update regression coverage for the Enter double-action bug and the new keyboard-first runner interactions.
