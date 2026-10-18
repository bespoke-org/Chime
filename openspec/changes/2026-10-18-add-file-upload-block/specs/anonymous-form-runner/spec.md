## ADDED Requirements

### Requirement: Respondent can attach a file to a file upload question
The system SHALL render a file upload block as a file control limited by the block's accepted types, together with a hint naming the accepted kinds and the size limit. When the respondent chooses a file, the system SHALL reject it in the browser without a network request when it exceeds the block's size limit or its type is not accepted, SHALL otherwise request a presigned upload URL from `POST /api/public/forms/<slug>/uploads`, send the file to that URL with the returned headers, and store the returned upload id as the answer. While the upload is in progress the control SHALL show a busy state. After the upload the system SHALL show the filename with a control that removes the file, which SHALL only clear the answer. A required file upload block SHALL block advancing until an upload id is stored. Upload failures SHALL be shown as localized messages that distinguish an unavailable storage (`503`), a rate limit (`429`) and a rejected file (`422`).

#### Scenario: Respondent attaches an accepted file
- **WHEN** a respondent chooses a 2 MB PNG on an images block with a 5 MB limit
- **THEN** the system requests an upload URL with the block id, filename, content type and size, sends the file to that URL, shows the filename and stores the upload id as the answer

#### Scenario: Respondent chooses a file that is too large
- **WHEN** a respondent chooses a file larger than the block's limit
- **THEN** the system shows a message naming the limit and makes no request

#### Scenario: Respondent chooses a file of a type that is not accepted
- **WHEN** a respondent chooses a PDF on an images block
- **THEN** the system shows that the file type is not accepted and makes no request

#### Scenario: Respondent removes the attached file
- **WHEN** a respondent uses the remove control next to the attached filename
- **THEN** the system clears the answer and shows the file control again

#### Scenario: Respondent continues without a required file
- **WHEN** a respondent tries to continue past a required file upload block without an attached file
- **THEN** the system shows the file-required message and stays on the block

#### Scenario: Respondent resumes a saved draft with a file answer
- **WHEN** a respondent restores a saved draft that holds an upload id for a file block
- **THEN** the system shows a generic attached-file label with the remove control, since the filename is not persisted with the draft

#### Scenario: Storage is not configured
- **WHEN** the upload URL request answers `503`
- **THEN** the system shows that file uploads are not available and keeps the respondent on the block
