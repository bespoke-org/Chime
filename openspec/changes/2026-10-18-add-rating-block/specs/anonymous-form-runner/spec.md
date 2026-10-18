## MODIFIED Requirements

### Requirement: Runner supports keyboard-first response entry
The system SHALL support keyboard-first answering for the active step in the public form runner. For single-choice, multiple-choice, and agreement questions, the system SHALL map visible options in display order to digit shortcuts using `1` through `9` and `0` for the tenth visible option when present, and SHALL show respondents that those shortcuts are available. For rating questions, the system SHALL map each digit key to the value it names when that value is on the scale, and SHALL map `0` to the value 10 when the scale reaches 10, otherwise to the value 0 when the scale starts at 0. The shortcut affordances for those choice-style actions SHALL remain visible on mobile layouts as well as larger screens. For questions with a primary typed input, the system SHALL focus that input when the step becomes active. Pressing Enter on the active step SHALL advance to the next question or submit on the last step when validation succeeds, and SHALL NOT also toggle or change a choice answer.

#### Scenario: Respondent selects a single-choice option with a number key
- **WHEN** a respondent is on a single-choice question and presses the digit key for a visible option
- **THEN** the system selects that option as the current answer for the question

#### Scenario: Respondent toggles a multiple-choice option with a number key
- **WHEN** a respondent is on a multiple-choice question and presses the digit key for a visible option that is already selected
- **THEN** the system removes that option from the current answer for the question

#### Scenario: Respondent selects a rating with a digit key
- **WHEN** a respondent is on a rating question and presses a digit key that names a value on the scale
- **THEN** the system selects that value as the current answer for the question

#### Scenario: Respondent selects 10 on a ten-point rating with the zero key
- **WHEN** a respondent is on a rating question whose scale ends at 10 and presses `0`
- **THEN** the system selects the value 10 as the current answer

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

### Requirement: Structured question answers are validated by block type
The system SHALL validate number, rating, link, agreement, and date answers according to the active block kind before allowing a respondent to advance or submit the form. When a text-answer block is configured with custom regex validation, the system SHALL also validate the respondent's text answer against that regex pattern.

#### Scenario: Respondent enters an invalid number
- **WHEN** a respondent provides a non-numeric value for a number block
- **THEN** the system blocks advancement and indicates that a valid number is required

#### Scenario: Respondent enters a float when floats are disallowed
- **WHEN** a respondent provides a decimal value for a number block configured to allow only whole numbers
- **THEN** the system blocks advancement and indicates that a whole number is required

#### Scenario: Respondent enters a value outside the allowed numeric range
- **WHEN** a respondent provides a number below the configured minimum or above the configured maximum for a number block
- **THEN** the system blocks advancement and indicates that the answer is outside the allowed range

#### Scenario: Respondent submits a rating outside the scale
- **WHEN** a rating answer arrives that is not a whole number or lies below the lowest or above the highest value of the scale
- **THEN** the system rejects the answer and indicates that it is outside the allowed range or not a whole number

#### Scenario: Respondent skips a required rating
- **WHEN** a respondent attempts to continue from a required rating block without selecting a value
- **THEN** the system blocks advancement and indicates that a rating is required

#### Scenario: Respondent enters an invalid link
- **WHEN** a respondent provides a malformed link value for a link block
- **THEN** the system blocks advancement and indicates that a valid link is required

#### Scenario: Respondent enters an invalid date
- **WHEN** a respondent provides an invalid or incomplete date value for a date block
- **THEN** the system blocks advancement and indicates that a valid date is required

#### Scenario: Respondent answers an optional agreement block
- **WHEN** a respondent selects agreed or not agreed for an optional agreement block
- **THEN** the system treats the explicit selection as the saved answer for that block

#### Scenario: Respondent enters text that does not match a configured regex
- **WHEN** a respondent provides a text answer for a text-answer block with custom regex validation and the answer does not match the saved pattern
- **THEN** the system blocks advancement and indicates that the answer format is invalid

## ADDED Requirements

### Requirement: Rating questions are answered on a visible scale
The system SHALL present a rating question as one control per value from the lowest to the highest value of the scale, SHALL show the configured end labels under the first and last values when they are set, SHALL mark the selected value, and SHALL store the selected value as a whole number string.

#### Scenario: Respondent sees the full scale
- **WHEN** a respondent reaches a rating question with a 0 to 10 scale
- **THEN** the system shows eleven selectable values from 0 to 10 with the end labels beneath the row

#### Scenario: Respondent picks and changes a rating
- **WHEN** a respondent selects a value and then selects a different value
- **THEN** the system keeps only the latest value as the current answer

#### Scenario: Respondent clears a rating
- **WHEN** a respondent selects the value that is already selected on an optional rating question
- **THEN** the system clears the answer for that question

#### Scenario: Respondent submits a rating
- **WHEN** a respondent submits a form after selecting the value 10 on a rating question
- **THEN** the system stores the answer `"10"` for that block
