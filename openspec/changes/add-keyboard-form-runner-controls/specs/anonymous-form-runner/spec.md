## ADDED Requirements

### Requirement: Runner supports keyboard-first response entry
The system SHALL support keyboard-first answering for the active step in the public form runner. For single-choice, multiple-choice, and agreement questions, the system SHALL map visible options in display order to digit shortcuts using `1` through `9` and `0` for the tenth visible option when present, and SHALL show respondents that those shortcuts are available. The shortcut affordances for those choice-style actions SHALL remain visible on mobile layouts as well as larger screens. For questions with a primary typed input, the system SHALL focus that input when the step becomes active. Pressing Enter on the active step SHALL advance to the next question or submit on the last step when validation succeeds, and SHALL NOT also toggle or change a choice answer.

#### Scenario: Respondent selects a single-choice option with a number key
- **WHEN** a respondent is on a single-choice question and presses the digit key for a visible option
- **THEN** the system selects that option as the current answer for the question

#### Scenario: Respondent toggles a multiple-choice option with a number key
- **WHEN** a respondent is on a multiple-choice question and presses the digit key for a visible option that is already selected
- **THEN** the system removes that option from the current answer for the question

#### Scenario: Respondent sees that keyboard shortcuts are available
- **WHEN** a respondent views a choice-based question in the public runner
- **THEN** the system shows visible shortcut affordances or helper text indicating which number keys can be used for the available options

#### Scenario: Respondent sees shortcut hints on mobile
- **WHEN** a respondent views a choice-based question on a mobile layout
- **THEN** the system still shows the shortcut affordances for the available actions instead of hiding them at that viewport size

#### Scenario: Respondent lands on a text-input question
- **WHEN** a respondent advances to a short text, long text, number, link, or date question
- **THEN** the system focuses the primary input control for that question by default

#### Scenario: Respondent presses Enter on a choice question
- **WHEN** a respondent presses Enter on an active choice question after making a valid selection
- **THEN** the system advances to the next step or submits on the last step without changing the current choice selection as a side effect
