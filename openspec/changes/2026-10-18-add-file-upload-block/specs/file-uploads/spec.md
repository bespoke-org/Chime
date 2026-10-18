## ADDED Requirements

### Requirement: Object storage is configured through S3 variables
The system SHALL read `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, with `S3_PUBLIC_ENDPOINT` defaulting to `S3_ENDPOINT` and `S3_REGION` defaulting to `garage`, and SHALL talk to storage through the S3 API with path-style addressing only. Presigned URLs SHALL be signed for the public endpoint and SHALL NOT require request checksums the browser cannot supply. When any required variable is missing the system SHALL treat storage as not configured and answer upload requests with `503`.

#### Scenario: Public endpoint differs from the internal one
- **WHEN** `S3_ENDPOINT` is `http://garage:3900` and `S3_PUBLIC_ENDPOINT` is `https://files.example.com`
- **THEN** presigned URLs use the `https://files.example.com` origin and the path `/<bucket>/<key>`

#### Scenario: Storage variables are missing
- **WHEN** a respondent requests an upload URL on a deployment without `S3_*` variables
- **THEN** the system answers `503` with a message that file uploads are not available

### Requirement: Public upload requests are validated and rate limited
The system SHALL accept `POST /api/public/forms/<slug>/uploads` with `{ blockId, filename, contentType, size }` only for a published and open form and a `FILE_UPLOAD` block of that form. The filename SHALL be reduced to its basename, stripped of control characters and leading dots, and limited to 200 characters; an empty result SHALL be rejected. The content type SHALL be lower-cased and stripped of parameters, SHALL be rejected when empty or on the denylist (`application/x-msdownload`, `application/x-sh`, `application/x-executable`, `application/java-archive`, `application/x-msi`, `text/html`, `application/xhtml+xml`, `image/svg+xml`), and SHALL match the block's accept list when it is `images` or `documents`. The size SHALL be a positive integer not above the block limit capped by `UPLOAD_MAX_SIZE_MB` (default 25). Requests SHALL be limited per client IP to `UPLOAD_RATE_LIMIT` (default 20) per `UPLOAD_RATE_WINDOW_SECONDS` (default 600). An accepted request SHALL create an `Upload` row in `PENDING` state with key `forms/<formId>/<blockId>/<uploadId>/<filename>` and SHALL answer `{ uploadId, url, method: "PUT", headers, expiresAt }` with a presigned `PUT` valid for 10 minutes whose signature covers the content length.

#### Scenario: Valid request
- **WHEN** a respondent asks to upload `cv.pdf` of 1 MB as `application/pdf` to a documents block with a 2 MB limit on an open form
- **THEN** the system stores a pending upload and answers with the upload id, the presigned URL and the `content-type` header to send

#### Scenario: Filename with a path
- **WHEN** the filename is `../../etc/passwd`
- **THEN** the stored filename and key end in `passwd` only

#### Scenario: Type outside the accept list
- **WHEN** the content type is `image/png` for a documents block
- **THEN** the system answers `422` and stores nothing

#### Scenario: Denied type on an any block
- **WHEN** the content type is `text/html` for a block accepting any file
- **THEN** the system answers `422`

#### Scenario: Size above the cap
- **WHEN** the block allows 25 MB, `UPLOAD_MAX_SIZE_MB` is 10 and the size is 11 MB
- **THEN** the system answers `422` naming 10 MB as the limit

#### Scenario: Closed form
- **WHEN** the form is published but closed
- **THEN** the system answers `410` before touching storage

#### Scenario: Too many requests
- **WHEN** a client IP exceeds the upload rate limit
- **THEN** the system answers `429`

### Requirement: File answers are verified when the response is submitted
When a submission contains answers for file upload blocks, the system SHALL load each referenced upload and SHALL reject the whole submission with `422 The uploaded file could not be verified.` unless the upload exists, belongs to the same form and block, is `PENDING`, and the object exists in storage with a size within the block's effective limit. The response insert and the change of the uploads to `ATTACHED` with the response id SHALL run in one transaction, and the change SHALL apply only to rows still `PENDING` so an upload is attached to at most one response. Submissions without file answers SHALL behave as before.

#### Scenario: Verified upload is attached
- **WHEN** a submission references a pending upload of the same form and block whose object is within the limit
- **THEN** the system stores the response and marks the upload attached with the response id

#### Scenario: Upload of another form or block
- **WHEN** a submission references an upload created for another form or another block
- **THEN** the system rejects the submission with `422` and stores nothing

#### Scenario: Object was never uploaded
- **WHEN** a submission references a pending upload whose object is missing in storage
- **THEN** the system rejects the submission with `422`

#### Scenario: Object exceeds the limit
- **WHEN** the stored object is larger than the block's effective limit
- **THEN** the system rejects the submission with `422`

#### Scenario: Upload already attached
- **WHEN** a submission references an upload that is already attached to a response
- **THEN** the system rejects the submission with `422`

### Requirement: Creators download files through an authenticated route
The system SHALL answer `GET /api/forms/<formId>/uploads/<uploadId>` with `401` without a session, `404` when the user cannot access the form or the upload is not `ATTACHED` to that form, and otherwise `302` to a presigned `GET` URL valid for 5 minutes that carries `Content-Disposition: attachment` with the original filename encoded per RFC 8187.

#### Scenario: Member of the form's workspace downloads a file
- **WHEN** an authenticated user with access to the form opens the download route for an attached upload
- **THEN** the system redirects to a presigned URL that serves the file as an attachment named after the original file

#### Scenario: Other user
- **WHEN** an authenticated user without access to the form opens the download route
- **THEN** the system answers `404`

#### Scenario: Pending upload
- **WHEN** the upload exists but was never attached to a response
- **THEN** the system answers `404`

### Requirement: Abandoned uploads are removed by a script
The system SHALL provide `bun run uploads:cleanup`, which deletes the object and the row of every `PENDING` upload created more than 24 hours ago, up to 1000 per run, and leaves attached uploads and recent pending uploads alone. The script SHALL be meant for cron; the app SHALL NOT run a scheduler of its own.

#### Scenario: Old pending upload
- **WHEN** the script runs and a pending upload is 25 hours old
- **THEN** its object is deleted from storage and its row from the database

#### Scenario: Recent pending or attached upload
- **WHEN** the script runs and an upload is pending for 2 hours, or attached at any age
- **THEN** the upload is kept
