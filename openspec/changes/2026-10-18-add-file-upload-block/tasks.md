## 1. Storage and schema

- [x] 1.1 Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` with pinned versions
- [x] 1.2 Add `lib/object-storage.ts` with env configuration, presigned PUT and GET against the public endpoint, head and delete, and an injectable storage for tests
- [x] 1.3 Add `FILE_UPLOAD`, `UploadStatus` and the `Upload` model to the Prisma schema and generate the migration

## 2. Shared block model

- [x] 2.1 Add the file upload config schema with `accept` and `maxSizeMb` and the presence-only branch operators
- [x] 2.2 Validate the answer as an upload id and name the question in the missing-file message
- [x] 2.3 Put filename sanitizing, content type rules, request parsing, verification and cleanup selection in `lib/uploads.ts`

## 3. Public upload and submission

- [x] 3.1 Add `POST /api/public/forms/[slug]/uploads` with the per-IP rate limit and the pending `Upload` row
- [x] 3.2 Verify file answers against the upload rows and storage on submit and attach them in the response transaction

## 4. Creator side

- [x] 4.1 Add the file block to the add-block menu and the accept and size selects to the block panel
- [x] 4.2 Add `GET /api/forms/[formId]/uploads/[uploadId]` redirecting to a presigned download for accessible forms
- [x] 4.3 Show filename, size and a download link on the response detail page and a download link in the question view
- [x] 4.4 Write the download URL for file answers in exports, webhooks and notification emails

## 5. Runner

- [x] 5.1 Render the file control with the accept list and size hint, pre-check size and type, upload through the presigned URL and store the upload id
- [x] 5.2 Show the attached filename with a remove control and localized error messages

## 6. Operations

- [x] 6.1 Add the Garage service and `garage/garage.toml` to `compose.yaml` and the init script with layout, bucket, key and CORS rule
- [x] 6.2 Add `scripts/cleanup-uploads.ts` and `bun run uploads:cleanup`
- [x] 6.3 Document setup, variables, CORS and cron in `docs/development.md`, `docs/deployment.md`, `.env.example` and the README
- [x] 6.4 Verify presigned PUT, HEAD, GET, DELETE and a CORS preflight against the local Garage

## 7. Verification

- [x] 7.1 Add tests for config parsing, content types, filenames, request parsing, verification, presigned URL hosts, the forms flows, the runner control, the builder panel, exports, webhooks and notifications
- [x] 7.2 Add every new locale key to both languages and run the translation check
- [x] 7.3 Run lint, typecheck, format check, tests and build
