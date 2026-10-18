import { z } from "zod";

import {
  FILE_UPLOAD_MAX_SIZE_MB,
  type FileUploadAccept,
  type FileUploadBlockConfig,
  type SerializedBlock,
} from "@/lib/blocks";
import { AppError } from "@/lib/errors";
import type { SubmissionAnswers } from "@/lib/form-submission";
import { SlidingWindowRateLimiter } from "@/lib/rate-limit";

export const BYTES_PER_MB = 1024 * 1024;
export const UPLOAD_FILENAME_MAX_LENGTH = 200;
export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
export const UPLOAD_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
] as const;

export const DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

// Types a browser or shell would run rather than display. "any" means
// anything but these.
export const DENIED_CONTENT_TYPES = [
  "application/x-msdownload",
  "application/x-sh",
  "application/x-executable",
  "application/java-archive",
  "application/x-msi",
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
] as const;

// "image/JPEG; charset=binary" -> "image/jpeg". Null when there is no type.
export function normalizeContentType(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const type = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type) ? type : null;
}

export function getAllowedContentTypes(
  accept: FileUploadAccept,
): readonly string[] | null {
  if (accept === "images") {
    return IMAGE_CONTENT_TYPES;
  }

  if (accept === "documents") {
    return DOCUMENT_CONTENT_TYPES;
  }

  return null;
}

export function isContentTypeAllowed(
  contentType: string | null,
  accept: FileUploadAccept,
) {
  if (!contentType) {
    return false;
  }

  if ((DENIED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return false;
  }

  const allowed = getAllowedContentTypes(accept);
  return allowed === null || allowed.includes(contentType);
}

// Value for the file input's accept attribute; empty means any file.
export function getAcceptAttribute(accept: FileUploadAccept) {
  return getAllowedContentTypes(accept)?.join(",") ?? "";
}

// Keeps the basename only, drops control characters and leading dots so the
// stored key never escapes its prefix or hides the file.
export function sanitizeUploadFilename(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const basename = value.split(/[\\/]/).pop() ?? "";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/^\.+/, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.length > UPLOAD_FILENAME_MAX_LENGTH
    ? cleaned.slice(0, UPLOAD_FILENAME_MAX_LENGTH)
    : cleaned;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// UPLOAD_MAX_SIZE_MB caps every block's own limit, so an operator can lower
// what creators may allow without touching their forms.
export function getUploadHardCapMb(
  env: Record<string, string | undefined> = process.env,
) {
  return readPositiveInteger(env.UPLOAD_MAX_SIZE_MB, FILE_UPLOAD_MAX_SIZE_MB);
}

export function getEffectiveMaxSizeBytes(
  config: Pick<FileUploadBlockConfig, "maxSizeMb">,
  env: Record<string, string | undefined> = process.env,
) {
  return Math.min(config.maxSizeMb, getUploadHardCapMb(env)) * BYTES_PER_MB;
}

export function formatSizeMb(bytes: number) {
  const mb = bytes / BYTES_PER_MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

export type UploadRequest = {
  blockId: string;
  filename: string;
  contentType: string;
  size: number;
};

const uploadRequestPayloadSchema = z.object({
  blockId: z.string().trim().min(1),
  filename: z.unknown(),
  contentType: z.unknown(),
  size: z.unknown(),
});

// Runs the pre-flight the respondent's browser also runs, but against the
// stored block config and the server cap; the route only trusts this result.
export function parseUploadRequest(
  blocks: SerializedBlock[],
  payload: unknown,
  env: Record<string, string | undefined> = process.env,
): UploadRequest {
  const parsed = uploadRequestPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Invalid upload request.", 422);
  }

  const block = blocks.find((entry) => entry.id === parsed.data.blockId);

  if (!block || block.type !== "FILE_UPLOAD") {
    throw new AppError("This question does not accept files.", 404);
  }

  const config = block.config as FileUploadBlockConfig;
  const filename = sanitizeUploadFilename(parsed.data.filename);

  if (!filename) {
    throw new AppError("The file needs a name.", 422);
  }

  const contentType = normalizeContentType(parsed.data.contentType);

  if (!contentType || !isContentTypeAllowed(contentType, config.accept)) {
    throw new AppError("This file type is not accepted here.", 422);
  }

  const size = parsed.data.size;

  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
    throw new AppError("The file is empty.", 422);
  }

  const maxSizeBytes = getEffectiveMaxSizeBytes(config, env);

  if (size > maxSizeBytes) {
    throw new AppError(
      `The file is larger than ${formatSizeMb(maxSizeBytes)} MB.`,
      422,
    );
  }

  return { blockId: block.id, filename, contentType, size };
}

export function buildUploadKey(input: {
  formId: string;
  blockId: string;
  uploadId: string;
  filename: string;
}) {
  return `forms/${input.formId}/${input.blockId}/${input.uploadId}/${input.filename}`;
}

export function buildUploadDownloadUrl(
  baseUrl: string,
  formId: string,
  uploadId: string,
) {
  return `${baseUrl.replace(/\/+$/, "")}/api/forms/${formId}/uploads/${uploadId}`;
}

export type FileUploadAnswer = {
  blockId: string;
  uploadId: string;
  maxSizeBytes: number;
};

// The file answers of a submission paired with the limit their block allows.
export function collectFileUploadAnswers(
  blocks: Array<Pick<SerializedBlock, "id" | "type" | "config">>,
  answers: SubmissionAnswers,
  env: Record<string, string | undefined> = process.env,
): FileUploadAnswer[] {
  return blocks.flatMap((block) => {
    const value = answers[block.id];

    if (block.type !== "FILE_UPLOAD" || typeof value !== "string") {
      return [];
    }

    return [
      {
        blockId: block.id,
        uploadId: value,
        maxSizeBytes: getEffectiveMaxSizeBytes(
          block.config as FileUploadBlockConfig,
          env,
        ),
      },
    ];
  });
}

export type UploadRecordLike = {
  id: string;
  formId: string;
  blockId: string;
  key: string;
  status: "PENDING" | "ATTACHED";
};

export type UploadVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing"
        | "wrong_form"
        | "wrong_block"
        | "not_pending"
        | "object_missing"
        | "too_large";
    };

// Decides whether a submitted upload id may be attached to the response.
// The object head comes from storage; null means nothing was uploaded.
export function verifyUploadForAnswer(input: {
  answer: FileUploadAnswer;
  formId: string;
  upload: UploadRecordLike | null;
  head: { size: number } | null;
}): UploadVerdict {
  const { answer, upload, head } = input;

  if (!upload) {
    return { ok: false, reason: "missing" };
  }

  if (upload.formId !== input.formId) {
    return { ok: false, reason: "wrong_form" };
  }

  if (upload.blockId !== answer.blockId) {
    return { ok: false, reason: "wrong_block" };
  }

  if (upload.status !== "PENDING") {
    return { ok: false, reason: "not_pending" };
  }

  if (!head) {
    return { ok: false, reason: "object_missing" };
  }

  if (head.size > answer.maxSizeBytes) {
    return { ok: false, reason: "too_large" };
  }

  return { ok: true };
}

export type UploadRateLimitConfig = {
  limit: number;
  windowMs: number;
};

export function getUploadRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): UploadRateLimitConfig {
  return {
    limit: readPositiveInteger(env.UPLOAD_RATE_LIMIT, 20),
    windowMs: readPositiveInteger(env.UPLOAD_RATE_WINDOW_SECONDS, 600) * 1000,
  };
}

export function assertUploadRateAllowed(
  limiter: SlidingWindowRateLimiter,
  clientIp: string,
) {
  if (!limiter.hit(clientIp).allowed) {
    throw new AppError("Too many uploads. Please try again later.", 429);
  }
}

let sharedLimiter: SlidingWindowRateLimiter | null = null;

export function getSharedUploadRateLimiter() {
  sharedLimiter ??= new SlidingWindowRateLimiter(getUploadRateLimitConfig());
  return sharedLimiter;
}

// A pending upload that was never attached within a day is abandoned: the
// presigned URL expired long ago and no submission can still reference it.
export function isExpiredPendingUpload(
  upload: { status: "PENDING" | "ATTACHED"; createdAt: Date },
  now: Date,
  maxAgeMs = UPLOAD_PENDING_MAX_AGE_MS,
) {
  return (
    upload.status === "PENDING" &&
    now.getTime() - upload.createdAt.getTime() > maxAgeMs
  );
}
