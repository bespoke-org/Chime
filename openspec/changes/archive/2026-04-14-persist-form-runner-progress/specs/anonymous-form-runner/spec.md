## ADDED Requirements

### Requirement: Runner preserves in-progress responses in the same browser
The system SHALL save a respondent's in-progress answers and current visited step for a published form in browser-local storage while the respondent is completing the form. When the same published form is reopened in the same browser before successful submission, the system SHALL restore the saved draft and resume from the last valid visited step instead of starting over.

#### Scenario: Respondent refreshes a form after answering several questions
- **WHEN** a respondent has entered answers on a published form and refreshes the page before submitting
- **THEN** the system restores the saved answers and reopens the runner at the last visited step for that saved draft

#### Scenario: Respondent reopens the same form in the same browser
- **WHEN** a respondent leaves a published form before submitting and later opens the same form again in the same browser
- **THEN** the system resumes the saved in-progress draft rather than presenting a blank new run

#### Scenario: Respondent is informed when progress is restored
- **WHEN** the runner successfully restores a saved draft
- **THEN** the system indicates that previously saved progress has been restored

### Requirement: Runner discards stale or completed local drafts safely
The system SHALL ignore and clear a saved local draft when that draft no longer matches the current published form structure, and SHALL clear the saved local draft after a successful submission so later visits begin as a new response.

#### Scenario: Saved draft no longer matches the published form
- **WHEN** a respondent opens a published form and a saved local draft exists for that form but its saved structure fingerprint does not match the current published form
- **THEN** the system discards the saved local draft, starts a fresh runner session, and indicates that saved progress could not be restored

#### Scenario: Respondent submits a form successfully
- **WHEN** a respondent completes and successfully submits a published form that has a saved local draft
- **THEN** the system clears the saved local draft for that form so reopening the form starts a new response
