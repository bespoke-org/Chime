import { describe, expect, test } from "bun:test";

import { parseBlockConfig, type SerializedBlock } from "@/lib/blocks";
import { AppError } from "@/lib/errors";
import {
  buildUploadDownloadUrl,
  buildUploadKey,
  collectFileUploadAnswers,
  getEffectiveMaxSizeBytes,
  getUploadHardCapMb,
  isContentTypeAllowed,
  isExpiredPendingUpload,
  normalizeContentType,
  parseUploadRequest,
  sanitizeUploadFilename,
  verifyUploadForAnswer,
} from "@/lib/uploads";

const MB = 1024 * 1024;

function fileBlock(
  config: Record<string, unknown> = {},
  overrides: Partial<SerializedBlock> = {},
): SerializedBlock {
  const now = new Date("2026-10-18T09:00:00.000Z");

  return {
    id: "file",
    formId: "form-1",
    type: "FILE_UPLOAD",
    title: "Attach your CV",
    description: "",
    required: false,
    position: 0,
    createdAt: now,
    updatedAt: now,
    config: parseBlockConfig("FILE_UPLOAD", config),
    ...overrides,
  } as SerializedBlock;
}

function tryParse(blocks: SerializedBlock[], payload: unknown, env = {}) {
  try {
    return parseUploadRequest(blocks, payload, env);
  } catch (error) {
    return error;
  }
}

describe("FILE_UPLOAD block config", () => {
  test("defaults to any file up to 10 MB", () => {
    expect(JSON.stringify(parseBlockConfig("FILE_UPLOAD", {}))).toBe(
      JSON.stringify({
        accept: "any",
        maxSizeMb: 10,
        branchRules: [],
        defaultNextBlockId: null,
        endForm: false,
      }),
    );
  });

  test("keeps valid values", () => {
    const config = parseBlockConfig("FILE_UPLOAD", {
      accept: "images",
      maxSizeMb: 25,
    }) as { accept: string; maxSizeMb: number };

    expect(config.accept).toBe("images");
    expect(config.maxSizeMb).toBe(25);
  });

  test("falls back to the defaults for out-of-range or malformed values", () => {
    for (const maxSizeMb of [0, 26, 1.5, "5", null]) {
      const config = parseBlockConfig("FILE_UPLOAD", { maxSizeMb }) as {
        maxSizeMb: number;
      };
      expect(config.maxSizeMb).toBe(10);
    }

    const config = parseBlockConfig("FILE_UPLOAD", { accept: "videos" }) as {
      accept: string;
    };
    expect(config.accept).toBe("any");
  });

  test("legacy config without file fields parses", () => {
    const config = parseBlockConfig("FILE_UPLOAD", {
      branchRules: [{ operator: "is_not_empty", targetBlockId: "b" }],
    }) as { accept: string; branchRules: unknown[] };

    expect(config.accept).toBe("any");
    expect(config.branchRules.length).toBe(1);
  });

  test("the env hard cap lowers a block's limit", () => {
    const config = { maxSizeMb: 25 };

    expect(getUploadHardCapMb({})).toBe(25);
    expect(getUploadHardCapMb({ UPLOAD_MAX_SIZE_MB: "10" })).toBe(10);
    expect(getUploadHardCapMb({ UPLOAD_MAX_SIZE_MB: "abc" })).toBe(25);
    expect(getEffectiveMaxSizeBytes(config, {})).toBe(25 * MB);
    expect(getEffectiveMaxSizeBytes(config, { UPLOAD_MAX_SIZE_MB: "10" })).toBe(
      10 * MB,
    );
    expect(
      getEffectiveMaxSizeBytes({ maxSizeMb: 5 }, { UPLOAD_MAX_SIZE_MB: "10" }),
    ).toBe(5 * MB);
  });
});

describe("content types", () => {
  test("normalizes case and strips parameters", () => {
    expect(normalizeContentType("image/JPEG; charset=binary")).toBe(
      "image/jpeg",
    );
    expect(normalizeContentType("  text/plain ")).toBe("text/plain");
    expect(normalizeContentType("")).toBe(null);
    expect(normalizeContentType("not a type")).toBe(null);
    expect(normalizeContentType(42)).toBe(null);
  });

  test("images accept only the image list", () => {
    expect(isContentTypeAllowed("image/png", "images")).toBe(true);
    expect(isContentTypeAllowed("image/heic", "images")).toBe(true);
    expect(isContentTypeAllowed("application/pdf", "images")).toBe(false);
    expect(isContentTypeAllowed("image/svg+xml", "images")).toBe(false);
  });

  test("documents accept only the document list", () => {
    expect(isContentTypeAllowed("application/pdf", "documents")).toBe(true);
    expect(
      isContentTypeAllowed(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "documents",
      ),
    ).toBe(true);
    expect(isContentTypeAllowed("image/png", "documents")).toBe(false);
    expect(isContentTypeAllowed("text/html", "documents")).toBe(false);
  });

  test("any accepts everything except the denylist and empty types", () => {
    expect(isContentTypeAllowed("application/zip", "any")).toBe(true);
    expect(isContentTypeAllowed("video/mp4", "any")).toBe(true);
    expect(isContentTypeAllowed(null, "any")).toBe(false);

    for (const denied of [
      "application/x-msdownload",
      "application/x-sh",
      "application/x-executable",
      "application/java-archive",
      "application/x-msi",
      "text/html",
      "application/xhtml+xml",
      "image/svg+xml",
    ]) {
      expect(isContentTypeAllowed(denied, "any")).toBe(false);
    }
  });
});

describe("sanitizeUploadFilename", () => {
  test("keeps the basename only", () => {
    expect(sanitizeUploadFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFilename("C:\\Users\\me\\cv.pdf")).toBe("cv.pdf");
  });

  test("removes control characters and leading dots", () => {
    expect(sanitizeUploadFilename("re\u0000port\n.pdf")).toBe("report.pdf");
    expect(sanitizeUploadFilename("...hidden")).toBe("hidden");
    expect(sanitizeUploadFilename(" . ")).toBe(null);
    expect(sanitizeUploadFilename("")).toBe(null);
    expect(sanitizeUploadFilename(undefined)).toBe(null);
  });

  test("keeps unicode and caps the length at 200", () => {
    expect(sanitizeUploadFilename("резюме Ады.pdf")).toBe("резюме Ады.pdf");
    expect(sanitizeUploadFilename("a".repeat(300))?.length).toBe(200);
  });
});

describe("parseUploadRequest", () => {
  const blocks = [
    fileBlock({ accept: "documents", maxSizeMb: 2 }),
    fileBlock(
      {},
      {
        id: "text",
        type: "SHORT_TEXT",
        config: parseBlockConfig("SHORT_TEXT", {}),
      },
    ),
  ];
  const valid = {
    blockId: "file",
    filename: "cv.pdf",
    contentType: "application/pdf",
    size: MB,
  };

  test("returns the normalized request", () => {
    expect(JSON.stringify(tryParse(blocks, valid))).toBe(
      JSON.stringify({
        blockId: "file",
        filename: "cv.pdf",
        contentType: "application/pdf",
        size: MB,
      }),
    );
  });

  test("rejects unknown blocks and blocks of another type", () => {
    for (const blockId of ["text", "nope"]) {
      const error = tryParse(blocks, { ...valid, blockId });
      expect(error instanceof AppError).toBe(true);
      expect((error as AppError).status).toBe(404);
    }
  });

  test("rejects a type outside the accept list", () => {
    const error = tryParse(blocks, { ...valid, contentType: "image/png" });
    expect((error as AppError).status).toBe(422);
  });

  test("rejects sizes over the limit, zero, negative and non-integer", () => {
    for (const size of [2 * MB + 1, 0, -5, 1.5, "100", undefined]) {
      const error = tryParse(blocks, { ...valid, size });
      expect(error instanceof AppError).toBe(true);
      expect((error as AppError).status).toBe(422);
    }

    expect(
      tryParse(blocks, { ...valid, size: 2 * MB }) instanceof AppError,
    ).toBe(false);
  });

  test("applies the env hard cap", () => {
    const error = tryParse(
      [fileBlock({ maxSizeMb: 25 })],
      { ...valid, size: 11 * MB },
      { UPLOAD_MAX_SIZE_MB: "10" },
    );
    expect((error as AppError).message).toBe("The file is larger than 10 MB.");
  });

  test("rejects an empty filename and strips paths", () => {
    expect(
      (tryParse(blocks, { ...valid, filename: "   " }) as AppError).status,
    ).toBe(422);
    expect(
      (
        tryParse(blocks, { ...valid, filename: "a/b/c.pdf" }) as {
          filename: string;
        }
      ).filename,
    ).toBe("c.pdf");
  });

  test("rejects a malformed payload", () => {
    expect((tryParse(blocks, null) as AppError).status).toBe(422);
    expect((tryParse(blocks, { filename: "x" }) as AppError).status).toBe(422);
  });
});

describe("keys and links", () => {
  test("builds the storage key and download URL", () => {
    expect(
      buildUploadKey({
        formId: "f",
        blockId: "b",
        uploadId: "u",
        filename: "cv.pdf",
      }),
    ).toBe("forms/f/b/u/cv.pdf");
    expect(buildUploadDownloadUrl("https://forms.example/", "f", "u")).toBe(
      "https://forms.example/api/forms/f/uploads/u",
    );
  });
});

describe("submission verification", () => {
  const blocks = [fileBlock({ maxSizeMb: 1 }), fileBlock({}, { id: "other" })];

  test("collects file answers with their limits", () => {
    const answers = collectFileUploadAnswers(
      blocks,
      { file: "up-1", other: "up-2", text: "Ada" },
      { UPLOAD_MAX_SIZE_MB: "5" },
    );

    expect(JSON.stringify(answers)).toBe(
      JSON.stringify([
        { blockId: "file", uploadId: "up-1", maxSizeBytes: MB },
        { blockId: "other", uploadId: "up-2", maxSizeBytes: 5 * MB },
      ]),
    );
  });

  const answer = { blockId: "file", uploadId: "up-1", maxSizeBytes: MB };
  const upload = {
    id: "up-1",
    formId: "form-1",
    blockId: "file",
    key: "forms/form-1/file/up-1/cv.pdf",
    status: "PENDING" as const,
  };

  test("accepts a pending upload of the same form and block with an object within the limit", () => {
    expect(
      JSON.stringify(
        verifyUploadForAnswer({
          answer,
          formId: "form-1",
          upload,
          head: { size: MB },
        }),
      ),
    ).toBe(JSON.stringify({ ok: true }));
  });

  test("rejects every mismatch", () => {
    const cases: Array<[Parameters<typeof verifyUploadForAnswer>[0], string]> =
      [
        [{ answer, formId: "form-1", upload: null, head: null }, "missing"],
        [
          {
            answer,
            formId: "form-1",
            upload: { ...upload, formId: "form-2" },
            head: { size: 1 },
          },
          "wrong_form",
        ],
        [
          {
            answer,
            formId: "form-1",
            upload: { ...upload, blockId: "other" },
            head: { size: 1 },
          },
          "wrong_block",
        ],
        [
          {
            answer,
            formId: "form-1",
            upload: { ...upload, status: "ATTACHED" },
            head: { size: 1 },
          },
          "not_pending",
        ],
        [{ answer, formId: "form-1", upload, head: null }, "object_missing"],
        [
          { answer, formId: "form-1", upload, head: { size: MB + 1 } },
          "too_large",
        ],
      ];

    for (const [input, reason] of cases) {
      const verdict = verifyUploadForAnswer(input);
      expect(verdict.ok).toBe(false);
      expect(verdict.ok ? "" : verdict.reason).toBe(reason);
    }
  });
});

describe("cleanup selection", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");

  test("selects only pending uploads older than 24 hours", () => {
    const old = new Date("2026-10-17T11:59:00.000Z");
    const recent = new Date("2026-10-17T12:01:00.000Z");

    expect(
      isExpiredPendingUpload({ status: "PENDING", createdAt: old }, now),
    ).toBe(true);
    expect(
      isExpiredPendingUpload({ status: "PENDING", createdAt: recent }, now),
    ).toBe(false);
    expect(
      isExpiredPendingUpload({ status: "ATTACHED", createdAt: old }, now),
    ).toBe(false);
  });
});
