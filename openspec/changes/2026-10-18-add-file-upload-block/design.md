## Context

Question blocks are threaded through the system by their `FormBlockType` value (see the rating block change). File answers differ from every existing type in that the value is not the content: the bytes live in object storage, the answer is a reference, and the server has to trust neither the reference nor the client's claims about the file. The app runs as one Node process in front of Postgres; there is no job queue and no worker, so anything asynchronous has to be a cron script.

## Goals / Non-Goals

**Goals:**
- One file per file block, uploaded by the browser directly to storage so the app never streams file bodies.
- The app stays backend-agnostic: plain S3 API, path-style addressing, no Garage-specific calls in application code.
- Every stored response references only files that were verified at submit time.
- Creators download through the app with their session; storage credentials never reach a browser.

**Non-Goals:**
- Several files per block, image previews, virus scanning or content sniffing.
- Deleting objects when a form or response is deleted.
- Public or respondent-facing downloads after submission.

## Decisions

### 1. Garage as the reference backend, S3 API as the contract
Local development runs Garage (`dxflrs/garage:v2.4.1`) from `compose.yaml` with a committed single-node `garage/garage.toml` (`replication_factor = 1`, sqlite metadata). Garage is a single AGPL binary with an S3 API and no console to maintain. MinIO was not chosen because its open-source server is no longer maintained. Application code uses `@aws-sdk/client-s3` with `forcePathStyle: true` and nothing else, so AWS S3, Ceph or another service only needs different `S3_*` values.

**Alternatives considered:**
- Files on local disk: rejected, the app would stream every upload and download and a second instance could not see the files.
- Files in Postgres as bytea: rejected for size and backup reasons.

### 2. Presigned PUT issued by a public, rate-limited endpoint
`POST /api/public/forms/<slug>/uploads` takes `{ blockId, filename, contentType, size }`, checks that the form is published and open (the same availability check as a submission), that the block is a file block, that the filename is a clean basename of at most 200 characters, that the content type is allowed for the block and not on the denylist, and that the size is a positive integer within the block's limit and the deployment cap. It creates an `Upload` row in `PENDING` state with key `forms/{formId}/{blockId}/{uploadId}/{filename}` and returns a presigned `PUT` valid for 10 minutes together with the `content-type` header to send. The URL is signed by a second S3 client that points at `S3_PUBLIC_ENDPOINT`, because the signature covers the host. `Content-Length` is a signed header, so a body of another size is refused by storage. The SDK's default request checksum is disabled (`requestChecksumCalculation: "WHEN_REQUIRED"`), otherwise the presigned URL carries an `x-amz-checksum-crc32` parameter the browser cannot satisfy and Garage answers `InvalidDigest`.

Requests are limited per client IP with the existing `SlidingWindowRateLimiter` (`UPLOAD_RATE_LIMIT`, default 20 per 10 minutes).

### 3. The answer is the upload id and is verified at submit
A file answer is stored as the upload id, a 1 to 64 character string of letters, digits, `-` and `_`. Client and server validation of the answer check only this shape and the required flag. In `createAnonymousResponse`, when the submission contains file answers, each upload is loaded and must belong to the form and the block and be `PENDING`; then `HeadObject` must find the object with a size within the block's limit. Any failure rejects the whole submission with `422 The uploaded file could not be verified.` The response insert and the `updateMany` that flips the uploads to `ATTACHED` with the response id run in one transaction, and the update is constrained to `PENDING` rows of the form so a concurrent submission cannot attach the same upload twice. Submissions without file answers keep the previous single insert.

The pure parts (matching answers to blocks and limits, the accept or reject decision from the head result) live in `lib/uploads.ts` and are unit tested; `lib/forms.ts` only wires them to Prisma and storage.

### 4. Accept lists and a denylist
`accept` is `any`, `images` (jpeg, png, gif, webp, heic) or `documents` (pdf, plain text, csv, Word and Excel in both generations). `any` means everything except executables and markup a browser would run: `application/x-msdownload`, `application/x-sh`, `application/x-executable`, `application/java-archive`, `application/x-msi`, `text/html`, `application/xhtml+xml`, `image/svg+xml`. Content types are lower-cased and stripped of parameters before the check; an empty type is rejected on the server, and the browser substitutes `application/octet-stream` when it cannot tell. The type is taken from the client and not sniffed; the denylist plus `Content-Disposition: attachment` on every download is what keeps a stored file from executing in a creator's browser.

### 5. Downloads through the app
`GET /api/forms/<formId>/uploads/<uploadId>` requires a session with access to the form (the same check as the builder routes) and an upload in `ATTACHED` state for that form, then answers `302` to a presigned `GET` valid for 5 minutes with `ResponseContentDisposition: attachment; filename*=UTF-8''...`. Exports, webhooks and emails write this route's absolute URL, built from `NEXTAUTH_URL`, so the link works for anyone who can open the response page and for nobody else. `serializeExportAnswer` takes an optional `{ baseUrl, formId }` for that purpose.

### 6. Cleanup from cron
`scripts/cleanup-uploads.ts` deletes `PENDING` uploads older than 24 hours from storage and the database, 1000 per run. The selection rule is a pure function with tests. No in-process scheduler: the app is one request-driven process, and a cron line is simpler to reason about and to run again after a failure.

### 7. Runner keeps filenames in memory only
The runner stores the upload id like any string answer, so draft persistence needs no change. The filename shown next to the remove button is kept in component state; after a restored draft the control says "File attached" without the name. Removing a file only clears the answer; the pending upload is left for cleanup.

## Risks / Trade-offs

- [Content type is client-declared] → Denylist, attachment disposition and no inline rendering anywhere in the app. Sniffing would need the bytes to pass through the app.
- [Public endpoint can fill storage with pending objects] → Per-IP rate limit, the form must be open, every object is bounded by the block limit and the deployment cap, and cleanup removes abandoned objects after a day.
- [Deleting a form leaves objects behind] → Rows cascade; objects stay until removed with bucket tooling. Documented.
- [Creator sets 25 MB while the deployment cap is lower] → The browser pre-check uses the block limit; the server rejects at the cap with a message naming the effective limit.
- [Multi-instance deployments] → The rate limiter is per process, as for submissions.

## Migration Plan

- `add_file_upload_block`: adds `FILE_UPLOAD` to `FormBlockType`, the `UploadStatus` enum and the `Upload` table with an index on `(formId, status, createdAt)` for cleanup and on `responseId` for the detail page. Rollback would drop the table and the enum; the enum value cannot be removed while any block uses it.

## Open Questions

- None.
