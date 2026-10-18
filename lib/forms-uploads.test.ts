import { describe, expect, test } from "bun:test";

type UploadRecord = {
  id: string;
  formId: string;
  blockId: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  status: "PENDING" | "ATTACHED";
  responseId: string | null;
};

let currentForm: Record<string, unknown> | null = null;
let uploads: UploadRecord[] = [];
let createdResponses: Array<Record<string, unknown>> = [];
let updateManyCalls: Array<Record<string, unknown>> = [];
let headSizes: Record<string, number | null> = {};
let headCalls: string[] = [];
let deletedKeys: string[] = [];
let deletedForms: string[] = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("server-only", () => ({}));

const dbMock = {
  form: {
    findFirst: async () => currentForm,
    delete: async (args: { where: { id: string } }) => {
      deletedForms.push(args.where.id);
      deletedKeys.push("<db>");
    },
  },
  response: {
    count: async () => 0,
    create: async (args: { data: Record<string, unknown> }) => {
      createdResponses.push(args.data);
      return {
        id: "resp-1",
        submittedAt: new Date("2026-10-18T10:00:00.000Z"),
        ...args.data,
      };
    },
  },
  upload: {
    findMany: async (args: {
      where: { id?: { in: string[] }; formId?: string };
    }) =>
      uploads.filter((upload) =>
        args.where.id
          ? args.where.id.in.includes(upload.id)
          : upload.formId === args.where.formId,
      ),
    findFirst: async (args: {
      where: { id: string; formId: string; status: string };
    }) =>
      uploads.find(
        (upload) =>
          upload.id === args.where.id &&
          upload.formId === args.where.formId &&
          upload.status === args.where.status,
      ) ?? null,
    updateMany: async (args: {
      where: { id: { in: string[] }; formId: string; status: string };
      data: Record<string, unknown>;
    }) => {
      updateManyCalls.push(args);
      const matched = uploads.filter(
        (upload) =>
          args.where.id.in.includes(upload.id) &&
          upload.formId === args.where.formId &&
          upload.status === args.where.status,
      );
      for (const upload of matched) {
        upload.status = "ATTACHED";
        upload.responseId = args.data.responseId as string;
      }
      return { count: matched.length };
    },
    create: async (args: { data: UploadRecord }) => {
      const record = {
        ...args.data,
        status: "PENDING" as const,
        responseId: null,
      };
      uploads.push(record);
      return record;
    },
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(dbMock),
};

mock.module("@/lib/db", () => ({ db: dbMock }));

const {
  createAnonymousResponse,
  deleteOwnedForm,
  getOwnedUploadDownloadUrl,
  requestAnonymousUpload,
} = await import("@/lib/forms");
const { setObjectStorage } = await import("@/lib/object-storage");
const { AppError } = await import("@/lib/errors");

setObjectStorage({
  createUploadUrl: async (input) => `https://files.example/${input.key}?put`,
  createDownloadUrl: async (input) =>
    `https://files.example/${input.key}?get&name=${input.filename}`,
  headObject: async (key) => {
    headCalls.push(key);
    const size = headSizes[key];
    return typeof size === "number" ? { size, contentType: "x" } : null;
  },
  deleteObject: async (key) => {
    deletedKeys.push(key);
  },
});

function block(id: string, type: string, config: Record<string, unknown>) {
  const now = new Date("2026-10-18T09:00:00.000Z");
  return {
    id,
    formId: "form-1",
    type,
    title: id,
    description: "",
    required: type === "FILE_UPLOAD",
    position: 0,
    config,
    createdAt: now,
    updatedAt: now,
  };
}

const MB = 1024 * 1024;

function pendingUpload(overrides: Partial<UploadRecord> = {}): UploadRecord {
  return {
    id: "up-1",
    formId: "form-1",
    blockId: "file",
    key: "forms/form-1/file/up-1/cv.pdf",
    filename: "cv.pdf",
    contentType: "application/pdf",
    size: MB,
    status: "PENDING",
    responseId: null,
    ...overrides,
  };
}

function reset(upload: UploadRecord | null, headSize: number | null) {
  currentForm = {
    id: "form-1",
    slug: "demo",
    title: "Demo",
    status: "PUBLISHED",
    webhookUrl: null,
    webhookSecret: null,
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    blocks: [block("file", "FILE_UPLOAD", { accept: "any", maxSizeMb: 1 })],
  };
  uploads = upload ? [upload] : [];
  createdResponses = [];
  updateManyCalls = [];
  headSizes = upload ? { [upload.key]: headSize } : {};
  headCalls = [];
  deletedKeys = [];
  deletedForms = [];
}

async function submit(uploadId = "up-1") {
  try {
    return await createAnonymousResponse("demo", { file: uploadId });
  } catch (error) {
    return error;
  }
}

function expectRejected(result: unknown) {
  expect(result instanceof AppError).toBe(true);
  expect((result as InstanceType<typeof AppError>).status).toBe(422);
  expect((result as Error).message).toBe(
    "The uploaded file could not be verified.",
  );
  expect(createdResponses.length).toBe(0);
  expect(updateManyCalls.length).toBe(0);
}

describe("createAnonymousResponse with file answers", () => {
  test("attaches a verified upload in the same transaction as the response", async () => {
    reset(pendingUpload(), MB);

    const result = await submit();

    expect(result instanceof AppError).toBe(false);
    expect(createdResponses.length).toBe(1);
    expect(JSON.stringify(headCalls)).toBe(
      JSON.stringify(["forms/form-1/file/up-1/cv.pdf"]),
    );
    expect(uploads[0].status).toBe("ATTACHED");
    expect(uploads[0].responseId).toBe("resp-1");
  });

  test("rejects an unknown upload id", async () => {
    reset(null, null);
    expectRejected(await submit());
    expect(headCalls.length).toBe(0);
  });

  test("rejects an upload of another form", async () => {
    reset(pendingUpload({ formId: "form-2" }), MB);
    expectRejected(await submit());
    expect(headCalls.length).toBe(0);
  });

  test("rejects an upload of another block", async () => {
    reset(pendingUpload({ blockId: "other" }), MB);
    expectRejected(await submit());
  });

  test("rejects an upload that is already attached", async () => {
    reset(pendingUpload({ status: "ATTACHED", responseId: "resp-0" }), MB);
    expectRejected(await submit());
    expect(headCalls.length).toBe(0);
  });

  test("rejects when the object was never uploaded", async () => {
    reset(pendingUpload(), null);
    expectRejected(await submit());
  });

  test("rejects when the stored object exceeds the block limit", async () => {
    reset(pendingUpload(), MB + 1);
    expectRejected(await submit());
  });

  test("rejects an id that is not an upload id", async () => {
    reset(pendingUpload(), MB);

    const result = await submit("not an id!");

    expect((result as InstanceType<typeof AppError>).status).toBe(422);
    expect(createdResponses.length).toBe(0);
  });
});

describe("requestAnonymousUpload", () => {
  test("creates a pending upload and returns the presigned PUT", async () => {
    reset(null, null);

    const result = await requestAnonymousUpload("demo", {
      blockId: "file",
      filename: "../cv.pdf",
      contentType: "application/PDF",
      size: 1000,
    });

    expect(uploads.length).toBe(1);
    expect(uploads[0].status).toBe("PENDING");
    expect(uploads[0].filename).toBe("cv.pdf");
    expect(uploads[0].key).toBe(`forms/form-1/file/${result.uploadId}/cv.pdf`);
    expect(result.method).toBe("PUT");
    expect(result.url).toBe(`https://files.example/${uploads[0].key}?put`);
    expect(JSON.stringify(result.headers)).toBe(
      JSON.stringify({ "content-type": "application/pdf" }),
    );
  });

  test("answers 410 for a closed form before touching storage", async () => {
    reset(null, null);
    currentForm = { ...currentForm, closedManually: true };

    try {
      await requestAnonymousUpload("demo", {
        blockId: "file",
        filename: "cv.pdf",
        contentType: "application/pdf",
        size: 10,
      });
      expect(false).toBe(true);
    } catch (error) {
      expect((error as InstanceType<typeof AppError>).status).toBe(410);
    }
    expect(uploads.length).toBe(0);
  });
});

describe("getOwnedUploadDownloadUrl", () => {
  test("denies a user without access to the form", async () => {
    reset(pendingUpload({ status: "ATTACHED", responseId: "resp-1" }), MB);
    currentForm = null;

    try {
      await getOwnedUploadDownloadUrl("stranger", "form-1", "up-1");
      expect(false).toBe(true);
    } catch (error) {
      expect((error as InstanceType<typeof AppError>).status).toBe(404);
      expect((error as Error).message).toBe("Form not found.");
    }
  });

  test("answers 404 for a pending upload", async () => {
    reset(pendingUpload(), MB);
    currentForm = { ...currentForm, blocks: [], user: {}, organization: null };

    try {
      await getOwnedUploadDownloadUrl("owner", "form-1", "up-1");
      expect(false).toBe(true);
    } catch (error) {
      expect((error as InstanceType<typeof AppError>).status).toBe(404);
      expect((error as Error).message).toBe("File not found.");
    }
  });

  test("returns the presigned GET for an attached upload", async () => {
    reset(pendingUpload({ status: "ATTACHED", responseId: "resp-1" }), MB);
    currentForm = { ...currentForm, blocks: [], user: {}, organization: null };

    expect(await getOwnedUploadDownloadUrl("owner", "form-1", "up-1")).toBe(
      "https://files.example/forms/form-1/file/up-1/cv.pdf?get&name=cv.pdf",
    );
  });
});

describe("deleteOwnedForm", () => {
  test("removes the form's objects after the row is gone", async () => {
    reset(pendingUpload(), MB);
    uploads.push(
      pendingUpload({ id: "up-2", key: "forms/form-1/file/up-2/photo.png" }),
      pendingUpload({ id: "up-3", formId: "form-2", key: "forms/form-2/x" }),
    );
    currentForm = { ...currentForm, blocks: [], user: {}, organization: null };

    await deleteOwnedForm("owner", "form-1");

    expect(deletedForms.join(",")).toBe("form-1");
    expect(deletedKeys.join(",")).toBe(
      "<db>,forms/form-1/file/up-1/cv.pdf,forms/form-1/file/up-2/photo.png",
    );
  });
});
