import { describe, expect, test } from "bun:test";

type BlockRecord = {
  id: string;
  formId: string;
  type: string;
  title: string;
  description: string;
  required: boolean;
  position: number;
  pageId: string | null;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type UploadRecord = {
  id: string;
  formId: string;
  blockId: string;
  key: string;
  status: "PENDING" | "ATTACHED";
  responseId: string | null;
  instanceIndex: number | null;
};

type UpdateManyCall = {
  where: { id: { in: string[] }; formId: string; status: string };
  data: {
    status: string;
    responseId: string;
    attachedAt: Date;
    instanceIndex: number | null;
  };
};

type SubmissionCall = {
  answers: Record<string, unknown>;
  pagesJson: unknown;
};

let currentForm: Record<string, unknown> | null = null;
let uploads: UploadRecord[] = [];
let createdResponses: Array<Record<string, unknown>> = [];
let updateManyCalls: UpdateManyCall[] = [];
let submissionCalls: SubmissionCall[] = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("server-only", () => ({}));

const dbMock = {
  form: {
    findFirst: async () => currentForm,
  },
  response: {
    count: async () => 0,
    create: async (args: { data: Record<string, unknown> }) => {
      createdResponses.push(args.data);
      return {
        id: "resp-1",
        submittedAt: new Date("2026-11-05T10:00:00.000Z"),
        ...args.data,
      };
    },
  },
  upload: {
    findMany: async (args: { where: { id: { in: string[] } } }) =>
      uploads.filter((upload) => args.where.id.in.includes(upload.id)),
    updateMany: async (args: UpdateManyCall) => {
      updateManyCalls.push(args);
      const matched = uploads.filter(
        (upload) =>
          args.where.id.in.includes(upload.id) &&
          upload.formId === args.where.formId &&
          upload.status === args.where.status,
      );
      for (const upload of matched) {
        upload.status = "ATTACHED";
        upload.responseId = args.data.responseId;
        upload.instanceIndex = args.data.instanceIndex;
      }
      return { count: matched.length };
    },
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(dbMock),
};

mock.module("@/lib/db", () => ({ db: dbMock }));

// buildSubmission belongs to the page-based walk of this change and lands
// separately; the stub keeps its agreed contract: the pages registry travels
// as the third argument and the normalized answers keep the per-instance
// nesting of repeating pages.
mock.module("@/lib/form-submission", () => ({
  assertReorderMatchesForm: () => {},
  parseSubmissionPayload: (payload: unknown) => payload,
  buildSubmission: (
    blocks: BlockRecord[],
    answersInput: Record<string, unknown>,
    pagesJson: unknown,
  ) => {
    submissionCalls.push({ answers: answersInput, pagesJson });
    return {
      normalizedAnswers: answersInput,
      snapshot: blocks.map((block) => ({ ...block })),
    };
  },
}));

const { createAnonymousResponse } = await import("@/lib/forms");
const { setObjectStorage } = await import("@/lib/object-storage");

setObjectStorage({
  createUploadUrl: async (input) => `https://files.example/${input.key}?put`,
  createDownloadUrl: async (input) =>
    `https://files.example/${input.key}?get&name=${input.filename}`,
  headObject: async () => ({ size: 1024, contentType: "x" }),
  deleteObject: async () => {},
});

function block(
  id: string,
  type: string,
  position: number,
  pageId: string | null,
): BlockRecord {
  const now = new Date("2026-11-05T09:00:00.000Z");
  return {
    id,
    formId: "form-1",
    type,
    title: id,
    description: "",
    required: false,
    position,
    pageId,
    config: type === "FILE_UPLOAD" ? { accept: "any", maxSizeMb: 5 } : {},
    createdAt: now,
    updatedAt: now,
  };
}

function repeatingForm(pagesJson: unknown): Record<string, unknown> {
  return {
    id: "form-1",
    slug: "demo",
    title: "Demo",
    status: "PUBLISHED",
    webhooks: [],
    organization: null,
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    pagesJson,
    blocks: [
      block("count", "NUMBER", 0, "page-1"),
      block("note", "SHORT_TEXT", 1, "page-2"),
      block("file", "FILE_UPLOAD", 2, "page-2"),
    ],
  };
}

function pendingUpload(id: string, blockId = "file"): UploadRecord {
  return {
    id,
    formId: "form-1",
    blockId,
    key: `forms/form-1/${blockId}/${id}/cv.pdf`,
    status: "PENDING",
    responseId: null,
    instanceIndex: null,
  };
}

function reset(
  pagesJson: unknown = [
    { id: "page-1" },
    { id: "page-2", repeat: { countBlockId: "count" } },
  ],
) {
  currentForm = repeatingForm(pagesJson);
  uploads = [];
  createdResponses = [];
  updateManyCalls = [];
  submissionCalls = [];
}

function submit(answers: Record<string, unknown>) {
  return createAnonymousResponse("demo", answers);
}

describe("createAnonymousResponse on repeating pages", () => {
  test("passes the pages registry to buildSubmission and stores nested answers as-is", async () => {
    reset();

    await submit({ count: "2", note: ["first", "second"] });

    expect(submissionCalls.length).toBe(1);
    expect(submissionCalls[0].pagesJson).toEqual([
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "count" } },
    ]);
    expect(createdResponses.length).toBe(1);
    expect(createdResponses[0].answersJson).toEqual({
      count: "2",
      note: ["first", "second"],
    });
    expect(updateManyCalls.length).toBe(0);
  });

  test("writes each instance upload's index on attach", async () => {
    reset();
    uploads = [pendingUpload("up-1"), pendingUpload("up-2")];

    await submit({ count: "2", file: ["up-1", "up-2"] });

    expect(updateManyCalls.length).toBe(2);
    expect(updateManyCalls[0].where.id.in).toEqual(["up-1"]);
    expect(updateManyCalls[0].data.instanceIndex).toBe(0);
    expect(updateManyCalls[1].where.id.in).toEqual(["up-2"]);
    expect(updateManyCalls[1].data.instanceIndex).toBe(1);
    expect(createdResponses[0].answersJson).toEqual({
      count: "2",
      file: ["up-1", "up-2"],
    });
    expect(uploads[0].instanceIndex).toBe(0);
    expect(uploads[1].instanceIndex).toBe(1);
  });

  test("numbers instances by their position in the answer array", async () => {
    reset();
    uploads = [pendingUpload("up-1"), pendingUpload("up-2")];

    await submit({ count: "3", file: ["up-1", null, "up-2"] });

    expect(updateManyCalls.length).toBe(2);
    expect(updateManyCalls[0].data.instanceIndex).toBe(0);
    expect(updateManyCalls[1].data.instanceIndex).toBe(2);
  });

  test("leaves uploads of non-repeating blocks instanceless in the same response", async () => {
    reset();
    currentForm = {
      ...repeatingForm([
        { id: "page-1" },
        { id: "page-2", repeat: { countBlockId: "count" } },
      ]),
      blocks: [
        block("count", "NUMBER", 0, "page-1"),
        block("intro-file", "FILE_UPLOAD", 1, "page-1"),
        block("file", "FILE_UPLOAD", 2, "page-2"),
      ],
    };
    uploads = [
      pendingUpload("up-intro", "intro-file"),
      pendingUpload("up-1"),
      pendingUpload("up-2"),
    ];

    await submit({
      count: "2",
      "intro-file": "up-intro",
      file: ["up-1", "up-2"],
    });

    expect(updateManyCalls.length).toBe(3);
    expect(updateManyCalls[0].where.id.in).toEqual(["up-intro"]);
    expect(updateManyCalls[0].data.instanceIndex).toBe(null);
    expect(updateManyCalls[1].data.instanceIndex).toBe(0);
    expect(updateManyCalls[2].data.instanceIndex).toBe(1);
  });

  test("keeps instanceIndex null when the repeat settings do not resolve", async () => {
    // The count block is a short text question, so the page degrades to a
    // single instance and its answer stays flat.
    reset([
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "note" } },
    ]);
    uploads = [pendingUpload("up-1")];

    await submit({ file: "up-1" });

    expect(updateManyCalls.length).toBe(1);
    expect(updateManyCalls[0].data.instanceIndex).toBe(null);
    expect(uploads[0].instanceIndex).toBe(null);
  });

  test("treats a flat answer on a repeating page as instanceless", async () => {
    reset();
    uploads = [pendingUpload("up-1")];

    await submit({ count: "2", file: "up-1" });

    expect(updateManyCalls.length).toBe(1);
    expect(updateManyCalls[0].data.instanceIndex).toBe(null);
  });
});
