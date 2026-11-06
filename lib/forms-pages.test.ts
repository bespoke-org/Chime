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

type FormRecord = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string;
  completionTitle: string;
  completionMessage: string;
  completionLinkLabel: string | null;
  completionLinkUrl: string | null;
  respondentLocale: string | null;
  showProgress: boolean;
  allowBackNavigation: boolean;
  closesAt: Date | null;
  maxResponses: number | null;
  closedManually: boolean;
  closedMessage: string;
  status: "DRAFT" | "PUBLISHED";
  pagesJson: unknown;
  updatedAt: Date;
  organization: { webhooks: [] } | null;
  webhooks: [];
  blocks: BlockRecord[];
  _count: { responses: number };
};

let currentForm: FormRecord | null = null;
let currentBlock: BlockRecord | null = null;
let formUpdates: Array<Record<string, unknown>> = [];
let blockUpdates: Array<Record<string, unknown>> = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("server-only", () => ({}));

mock.module("@/lib/db", () => ({
  db: {
    $transaction: async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    form: {
      findFirst: async () => currentForm,
      // ensureUniqueSlug sees every slug as free.
      findUnique: async () => null,
      update: async (args: { data: Record<string, unknown> }) => {
        formUpdates.push(args.data);
        return { ...currentForm, ...args.data };
      },
    },
    formBlock: {
      findFirst: async () => currentBlock,
      update: async (args: { data: Record<string, unknown> }) => {
        blockUpdates.push(args.data);
        return { ...currentBlock, ...args.data };
      },
    },
    user: {
      findUnique: async () => ({
        notificationEmail: null,
        formSubscriptions: [],
      }),
    },
  },
}));

const {
  getOwnedFormForBuilder,
  updateOwnedFormMetadata,
  updateOwnedBlock,
  reorderOwnedBlocks,
} = await import("@/lib/forms");

function block(
  id: string,
  type: string,
  position: number,
  pageId: string | null = null,
) {
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
    config: {},
    createdAt: now,
    updatedAt: now,
  };
}

function resetTestState(overrides: Partial<FormRecord> = {}) {
  currentForm = {
    id: "form-1",
    userId: "user-1",
    slug: "demo",
    title: "Demo",
    description: "",
    completionTitle: "",
    completionMessage: "",
    completionLinkLabel: null,
    completionLinkUrl: null,
    respondentLocale: null,
    showProgress: true,
    allowBackNavigation: true,
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    closedMessage: "",
    status: "DRAFT",
    pagesJson: null,
    updatedAt: new Date("2026-11-05T09:00:00.000Z"),
    organization: null,
    webhooks: [],
    blocks: [
      block("intro", "TEXT", 0, "page-1"),
      block("q-1", "SHORT_TEXT", 1, "page-2"),
    ],
    _count: { responses: 0 },
    ...overrides,
  };
  currentBlock = null;
  formUpdates = [];
  blockUpdates = [];
}

function metadataPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Demo",
    slug: "demo",
    ...overrides,
  };
}

describe("form pages persistence", () => {
  test("loads the registry and block page ids into the builder payload", async () => {
    resetTestState({
      pagesJson: [{ id: "page-1" }, { id: "page-2" }],
    });

    const form = await getOwnedFormForBuilder("user-1", "form-1");

    expect(form.pages).toEqual([{ id: "page-1" }, { id: "page-2" }]);
    expect(form.blocks.map((savedBlock) => savedBlock.pageId)).toEqual([
      "page-1",
      "page-2",
    ]);
  });

  test("drops malformed registry entries instead of failing the payload", async () => {
    resetTestState({
      pagesJson: [{ id: "page-1" }, { id: "" }, "page-2", { noId: true }],
    });

    const form = await getOwnedFormForBuilder("user-1", "form-1");

    expect(form.pages).toEqual([{ id: "page-1" }]);
  });

  test("returns an empty page list for a form saved before pages", async () => {
    resetTestState({
      pagesJson: null,
      blocks: [block("intro", "TEXT", 0), block("q-1", "SHORT_TEXT", 1)],
    });

    const form = await getOwnedFormForBuilder("user-1", "form-1");

    expect(form.pages).toEqual([]);
    expect(form.blocks.map((savedBlock) => savedBlock.pageId)).toEqual([
      null,
      null,
    ]);
  });

  test("writes pagesJson when the payload carries pages", async () => {
    resetTestState();

    const form = await updateOwnedFormMetadata(
      "user-1",
      "form-1",
      metadataPayload({
        pages: [{ id: "page-1" }, { id: "page-2" }],
      }),
    );

    expect(formUpdates.length).toBe(1);
    expect(formUpdates[0].pagesJson).toEqual([
      { id: "page-1" },
      { id: "page-2" },
    ]);
    // The saved registry comes back on the builder payload.
    expect(form.pages).toEqual([{ id: "page-1" }, { id: "page-2" }]);
  });

  test("saves and reads back a registry entry with repeat settings", async () => {
    resetTestState();

    const form = await updateOwnedFormMetadata(
      "user-1",
      "form-1",
      metadataPayload({
        pages: [
          { id: "page-1" },
          { id: "page-2", repeat: { countBlockId: "q-1" } },
        ],
      }),
    );

    expect(formUpdates.length).toBe(1);
    expect(formUpdates[0].pagesJson).toEqual([
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "q-1" } },
    ]);
    // The saved registry comes back on the builder payload.
    expect(form.pages).toEqual([
      { id: "page-1" },
      { id: "page-2", repeat: { countBlockId: "q-1" } },
    ]);
  });

  test("keeps the stored registry when an old client sends no pages", async () => {
    resetTestState({
      pagesJson: [{ id: "page-1" }],
    });

    const form = await updateOwnedFormMetadata(
      "user-1",
      "form-1",
      metadataPayload(),
    );

    expect(formUpdates.length).toBe(1);
    expect("pagesJson" in formUpdates[0]).toBe(false);
    // The update returned the record as the database still holds it.
    expect(form.pages).toEqual([{ id: "page-1" }]);
  });

  test("writes the block pageId when the payload carries one", async () => {
    resetTestState();
    currentBlock = block("q-1", "SHORT_TEXT", 1, "page-1");

    const saved = await updateOwnedBlock("user-1", "form-1", "q-1", {
      pageId: "page-2",
    });

    expect(blockUpdates.length).toBe(1);
    expect(blockUpdates[0].pageId).toBe("page-2");
    expect(saved.pageId).toBe("page-2");
  });

  test("clears the block pageId on null", async () => {
    resetTestState();
    currentBlock = block("q-1", "SHORT_TEXT", 1, "page-1");

    await updateOwnedBlock("user-1", "form-1", "q-1", { pageId: null });

    expect(blockUpdates[0].pageId).toBe(null);
  });

  test("keeps the block pageId when an old client sends none", async () => {
    resetTestState();
    currentBlock = block("q-1", "SHORT_TEXT", 1, "page-1");

    const saved = await updateOwnedBlock("user-1", "form-1", "q-1", {
      title: "Your name",
    });

    expect(blockUpdates.length).toBe(1);
    expect("pageId" in blockUpdates[0]).toBe(false);
    expect(saved.pageId).toBe("page-1");
  });
});

describe("page reordering persistence", () => {
  test("saves block positions and the page registry together", async () => {
    resetTestState();
    const pages = [
      { id: "page-2", repeat: { countBlockId: "intro" } },
      { id: "empty" },
      { id: "page-1" },
    ];
    await reorderOwnedBlocks("user-1", "form-1", {
      blockIds: ["q-1", "intro"],
      pages,
    });
    expect(blockUpdates).toEqual([{ position: 0 }, { position: 1 }]);
    expect(formUpdates).toEqual([{ pagesJson: pages }]);
  });

  test("legacy block reorders leave the registry unchanged", async () => {
    resetTestState();
    await reorderOwnedBlocks("user-1", "form-1", {
      blockIds: ["q-1", "intro"],
    });
    expect(formUpdates).toEqual([]);
    expect(blockUpdates.length).toBe(2);
  });

  test("rejects malformed pages before any updates", async () => {
    resetTestState();
    let rejected = false;
    try {
      await reorderOwnedBlocks("user-1", "form-1", {
        blockIds: ["q-1", "intro"],
        pages: [{ id: "" }],
      });
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
    expect(formUpdates).toEqual([]);
    expect(blockUpdates).toEqual([]);
  });
});
