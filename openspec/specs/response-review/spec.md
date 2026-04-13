## Purpose

Define how authenticated creators review form responses, inspect individual submissions, export results, and understand branching context within accessible workspaces.
## Requirements
### Requirement: Creator can list responses for owned forms
The system SHALL allow an authenticated creator to view submitted responses for personal forms they own and organization forms belonging to organizations where they are members, and SHALL prevent them from listing responses for forms outside those accessible workspaces.

#### Scenario: Creator opens responses for a personal form they own
- **WHEN** an authenticated creator opens the responses view for a personal form they own
- **THEN** the system displays the submitted responses for that form

#### Scenario: Creator opens responses for an organization form in a joined organization
- **WHEN** an authenticated creator opens the responses view for a form belonging to an organization where they are a member
- **THEN** the system displays the submitted responses for that form

#### Scenario: Creator opens responses for an inaccessible form
- **WHEN** an authenticated creator opens the responses view for a form they do not own personally and that does not belong to an organization they are part of
- **THEN** the system denies access to that form's submitted responses

### Requirement: Creator can inspect a single response in form order
The system SHALL allow an authenticated creator to open an individual response and inspect answers mapped to the corresponding form blocks in the saved block order.

#### Scenario: Creator opens one response
- **WHEN** an authenticated creator selects a submitted response for a form they own
- **THEN** the system displays that response's answers in the order of the form's blocks

#### Scenario: Creator inspects response with text blocks in the form
- **WHEN** an authenticated creator views a response for a form that includes text blocks
- **THEN** the system shows only answerable block responses while preserving the form order context for the submission

### Requirement: Creator can start response exports from the responses view
The system SHALL present response export actions in the responses view for a form in a workspace the authenticated creator can access.

#### Scenario: Creator opens responses for an accessible form
- **WHEN** an authenticated creator opens the responses view for a form in a workspace they can access
- **THEN** the system displays available export actions for the supported response export formats

### Requirement: Creator can inspect branching route context for a submission
The system SHALL allow an authenticated creator to inspect the visited route and skipped sections for an individual submission from a branched form while preserving the submission's saved form-order context.

#### Scenario: Creator opens a branched submission
- **WHEN** an authenticated creator views a response submitted through a branched form
- **THEN** the system shows which blocks were visited in the submission path and which blocks were skipped by branching

#### Scenario: Creator reviews a decision point in the visited path
- **WHEN** an authenticated creator inspects a visited branching question in a submission
- **THEN** the system shows the submitted answer in context so the taken route is understandable

### Requirement: Creator can switch response review between submissions and questions
The system SHALL allow an authenticated creator to switch the responses page for an accessible form between a submission-centric list and a question-centric list while keeping submission review as the default mode.

#### Scenario: Creator opens responses for a form
- **WHEN** an authenticated creator opens the responses view for a form they can access
- **THEN** the system shows the submission-centric list by default and offers a control to switch to question-centric review

#### Scenario: Creator switches to question-centric review
- **WHEN** an authenticated creator selects the question-centric responses mode
- **THEN** the system shows answerable form blocks in form order instead of individual submissions

#### Scenario: Creator switches back to submission review
- **WHEN** an authenticated creator returns to the submission-centric responses mode after viewing question-centric review
- **THEN** the system shows the existing submission list again

### Requirement: Creator can inspect aggregate answers for a question
The system SHALL allow an authenticated creator to inspect a question-level summary for each answerable block using stored submissions that reached that block.

#### Scenario: Creator reviews a choice question
- **WHEN** an authenticated creator views a single-choice, multiple-choice, or agreement block in question-centric review
- **THEN** the system shows aggregate counts for the available answer options based on submissions that reached that block

#### Scenario: Creator reviews a numeric question
- **WHEN** an authenticated creator views a number block in question-centric review
- **THEN** the system shows aggregate numeric summary information derived from submitted answers for that block

#### Scenario: Creator reviews a freeform answer question
- **WHEN** an authenticated creator views a short text, long text, link, or date block in question-centric review
- **THEN** the system shows the submitted answers for that block together with summary counts for answered responses

#### Scenario: Creator reviews a branched question
- **WHEN** an authenticated creator views a question that is skipped for some submissions because of branching
- **THEN** the system distinguishes submissions that reached the block from submissions that skipped it by route

#### Scenario: Creator reviews a question with no submitted answers
- **WHEN** an authenticated creator views a question that has no answers yet
- **THEN** the system shows an empty summary state for that question instead of failing or hiding the block

### Requirement: Response review renders authored Markdown context consistently
The system SHALL render the supported authored Markdown subset in creator-facing response review surfaces wherever question descriptions or text block bodies are shown as form context.

#### Scenario: Creator reviews a response with formatted question context
- **WHEN** an authenticated creator opens a response that includes a question description with supported Markdown
- **THEN** the response review UI shows the formatted description instead of raw Markdown syntax

#### Scenario: Creator reviews a response with formatted text block context
- **WHEN** an authenticated creator opens a response or question summary that includes a text block body with supported Markdown
- **THEN** the response review UI shows the formatted text block content consistently with the shared authored Markdown rules

