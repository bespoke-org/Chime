## ADDED Requirements

### Requirement: Builder chrome stays focused on editing
The system SHALL present the creator builder with concise, editing-focused chrome that emphasizes form status, navigation, and editing actions. The builder SHALL avoid promotional hero copy or decorative overview treatments that compete with the editing workflow.

#### Scenario: Creator opens the builder
- **WHEN** an authenticated creator opens an owned form in the builder
- **THEN** the system shows the form title, current status, and core actions needed to edit, publish, copy the link, or review responses without marketing-style framing

#### Scenario: Creator reads helper copy in the builder
- **WHEN** an authenticated creator views builder headings, descriptions, or empty states
- **THEN** the system uses short task-oriented copy that explains the current editing context without persuasive or ornamental language
