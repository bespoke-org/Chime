## Why

Forms that collect applications, receipts or proofs need a file from the respondent, and today the only way is to ask for a link to a file hosted elsewhere. Creators then chase files across services, and respondents without a place to host them cannot answer at all.

## What Changes

- Add a file upload question block. The creator chooses which kinds of files are accepted (any, images or documents) and a size limit between 1 and 25 MB; an operator-set hard cap can lower that limit for the whole deployment. Executable and HTML files are never accepted.
- Store files in S3-compatible object storage reached through the plain S3 API with path-style addressing. Local development runs Garage from `compose.yaml`; a deployment can point the same variables at any S3 service.
- Upload from the respondent's browser straight to storage through a short-lived presigned `PUT` URL issued by a rate-limited public endpoint. The answer stored with the response is the upload id.
- Verify every file answer when the response is submitted: the id must name a pending upload of that form and block, the object must exist and be within the limit. The upload is marked attached in the same transaction as the response.
- Show the filename and size with a download link on the response detail page. The link goes through an authenticated app route that redirects to a presigned `GET` valid for 5 minutes. Exports, webhooks and notification emails carry that link in place of the answer.
- Remove uploads that were requested but never attached with a script meant for cron.

## Capabilities

### New Capabilities
- `file-uploads`: object storage configuration, the presigned upload flow, verification on submit, authenticated downloads and cleanup of abandoned uploads.

### Modified Capabilities
- `conversational-form-builder`: add the file upload block type with its accept and size settings and presence-only branching.
- `anonymous-form-runner`: render the file control, upload the file before the answer is submitted and surface upload errors.
- `response-review`: show the attached file with a download link on the response detail page and in the question-centric view.
- `response-export`: write the download URL for file answers.

## Impact

- Affected code: Prisma schema (`FILE_UPLOAD` enum value, `Upload` model and `UploadStatus` enum) with a migration; `lib/blocks.ts`, `lib/answer-validation.ts`, `lib/form-submission.ts`, `lib/branching.ts`; new `lib/object-storage.ts` and `lib/uploads.ts`; `lib/forms.ts` for the upload request, submit verification and download URL; two API routes; the builder panel, the public runner and the response pages; exports, webhooks and notifications; `compose.yaml`, `garage/garage.toml`, `scripts/garage-init.sh`, `scripts/garage-cors.ts`, `scripts/cleanup-uploads.ts`; docs, `.env.example`, locales, tests and specs.
- New dependencies: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- Without the `S3_*` variables the block can still be added to a form, but upload requests answer `503`.
