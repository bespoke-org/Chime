import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import type { PublicForm } from "@/lib/form-types";
import {
  PUBLIC_FORM_DRAFT_STORAGE_PREFIX,
  createPublicFormDraft,
  createPublicFormDraftFingerprint,
  getPublicFormDraftStorageKey,
  parsePublicFormDraft,
  readStoredPublicFormDraft,
  removeStoredPublicFormDraft,
  writeStoredPublicFormDraft,
  type PublicFormDraft,
} from "@/lib/public-form-draft";

function createForm(blocks: SerializedBlock[]): PublicForm {
  return {
    id: "form-1",
    title: "Demo form",
    description: "",
    completionTitle: "Thanks",
    completionMessage: "Done",
    completionLinkLabel: null,
    completionLinkUrl: null,
    respondentLocale: null,
    showProgress: true,
    allowBackNavigation: true,
    closedMessage: "",
    slug: "demo-form",
    pages: [],
    blocks,
  };
}

function createBlock(
  overrides: Partial<SerializedBlock> & Pick<SerializedBlock, "id" | "type">,
): SerializedBlock {
  const now = new Date("2026-04-14T00:00:00.000Z");

  return {
    id: overrides.id,
    formId: "form-1",
    type: overrides.type,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? "",
    required: overrides.required ?? false,
    position: overrides.position ?? 0,
    pageId: overrides.pageId ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    config:
      overrides.config ??
      (overrides.type === "TEXT"
        ? { body: "Intro" }
        : overrides.type === "SINGLE_CHOICE"
          ? {
              options: ["yes", "no"],
              branchRules: [],
              defaultNextBlockId: null,
            }
          : {
              placeholder: "",
              validationRegex: null,
              branchRules: [],
              defaultNextBlockId: null,
            }),
  };
}

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "window",
);

function mockWindowWithStorage(storage: {
  getItem: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: storage.getItem,
        setItem: storage.setItem ?? (() => undefined),
        removeItem: storage.removeItem ?? (() => undefined),
      },
    },
  });
}

function restoreWindow() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
}

describe("public form draft fingerprint", () => {
  const baseBlocks = [
    createBlock({ id: "intro", type: "TEXT", position: 0 }),
    createBlock({ id: "choice", type: "SINGLE_CHOICE", position: 1 }),
  ];
  const baseFingerprint = createPublicFormDraftFingerprint(
    createForm(baseBlocks),
  );

  test("changes when an option is renamed", () => {
    const blocks = [
      baseBlocks[0],
      createBlock({
        id: "choice",
        type: "SINGLE_CHOICE",
        position: 1,
        config: {
          options: ["yes", "maybe"],
          branchRules: [],
          defaultNextBlockId: null,
        },
      }),
    ];

    expect(
      createPublicFormDraftFingerprint(createForm(blocks)) !== baseFingerprint,
    ).toBe(true);
  });

  test("changes when blocks are reordered, retyped or made required", () => {
    const reordered = [
      createBlock({ id: "intro", type: "TEXT", position: 1 }),
      createBlock({ id: "choice", type: "SINGLE_CHOICE", position: 0 }),
    ];
    const retyped = [
      baseBlocks[0],
      createBlock({
        id: "choice",
        type: "MULTIPLE_CHOICE",
        position: 1,
        config: baseBlocks[1].config,
      }),
    ];
    const required = [
      baseBlocks[0],
      createBlock({
        id: "choice",
        type: "SINGLE_CHOICE",
        position: 1,
        required: true,
      }),
    ];

    for (const blocks of [reordered, retyped, required]) {
      expect(
        createPublicFormDraftFingerprint(createForm(blocks)) !==
          baseFingerprint,
      ).toBe(true);
    }
  });

  test("ignores title, description and timestamps", () => {
    const blocks = [
      createBlock({
        id: "intro",
        type: "TEXT",
        position: 0,
        title: "New title",
        description: "New description",
        updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      }),
      createBlock({
        id: "choice",
        type: "SINGLE_CHOICE",
        position: 1,
        title: "Renamed",
      }),
    ];

    expect(createPublicFormDraftFingerprint(createForm(blocks))).toBe(
      baseFingerprint,
    );
  });

  test("does not depend on key order inside configs", () => {
    const blocks = [
      baseBlocks[0],
      createBlock({
        id: "choice",
        type: "SINGLE_CHOICE",
        position: 1,
        config: {
          defaultNextBlockId: null,
          branchRules: [],
          options: ["yes", "no"],
        },
      }),
    ];

    expect(createPublicFormDraftFingerprint(createForm(blocks))).toBe(
      baseFingerprint,
    );
  });
});

describe("public form draft parsing and restoring", () => {
  const form = createForm([
    createBlock({ id: "intro", type: "TEXT", position: 0 }),
    createBlock({ id: "choice", type: "SINGLE_CHOICE", position: 1 }),
    createBlock({ id: "notes", type: "LONG_TEXT", position: 2 }),
  ]);

  function validDraft(
    overrides: Partial<PublicFormDraft> = {},
  ): PublicFormDraft {
    return {
      ...createPublicFormDraft(form, {
        answers: { choice: "yes" },
        history: ["intro", "choice"],
        cursor: 1,
      }),
      ...overrides,
    };
  }

  test("rejects a draft with another version or malformed fields", () => {
    expect(parsePublicFormDraft({ ...validDraft(), version: 2 })).toBe(null);
    expect(parsePublicFormDraft({ ...validDraft(), cursor: -1 })).toBe(null);
    expect(parsePublicFormDraft({ ...validDraft(), cursor: 1.5 })).toBe(null);
    expect(
      parsePublicFormDraft({ ...validDraft(), savedAt: "yesterday" }),
    ).toBe(null);
    expect(
      parsePublicFormDraft({ ...validDraft(), answers: { choice: 1 } }),
    ).toBe(null);
    expect(
      parsePublicFormDraft({ ...validDraft(), answers: { choice: [1] } }),
    ).toBe(null);
    expect(parsePublicFormDraft({ ...validDraft(), history: "intro" })).toBe(
      null,
    );
    expect(parsePublicFormDraft(null)).toBe(null);
    expect(parsePublicFormDraft("{}")).toBe(null);
    expect(parsePublicFormDraft(validDraft()) !== null).toBe(true);
  });

  test("strips non-string answers when creating a draft", () => {
    const draft = createPublicFormDraft(form, {
      answers: {
        choice: "yes",
        notes: 42 as unknown as string,
        other: [1, "a"] as unknown as string[],
      },
      history: ["intro"],
      cursor: 0,
    });

    expect(JSON.stringify(draft.answers)).toBe(
      JSON.stringify({ choice: "yes" }),
    );
  });
});

describe("public form drafts of repeating pages", () => {
  const form = createForm([
    createBlock({ id: "count", type: "NUMBER", position: 0 }),
    createBlock({ id: "member", type: "SHORT_TEXT", position: 1 }),
    createBlock({ id: "drinks", type: "MULTIPLE_CHOICE", position: 2 }),
  ]);

  test("keeps the per-instance answers and instance steps", () => {
    const draft = createPublicFormDraft(form, {
      answers: {
        count: "2",
        member: ["Ann", "Bob"],
        drinks: [["Tea", "Coffee"], null as unknown as string[]],
      },
      history: ["count", "members", "members#1"],
      cursor: 2,
    });

    const restored = parsePublicFormDraft(JSON.parse(JSON.stringify(draft)));

    expect(restored === null).toBe(false);
    if (restored) {
      expect(JSON.stringify(restored.answers)).toBe(
        JSON.stringify(draft.answers),
      );
      expect(JSON.stringify(restored.history)).toBe(
        JSON.stringify(["count", "members", "members#1"]),
      );
      expect(restored.cursor).toBe(2);
    }
  });

  test("rejects nested values that are not strings", () => {
    const draft = createPublicFormDraft(form, {
      answers: {
        member: ["Ann", [7]] as unknown as string[],
      },
      history: ["count"],
      cursor: 0,
    });

    expect(JSON.stringify(draft.answers)).toBe(JSON.stringify({}));
    expect(
      parsePublicFormDraft({
        ...draft,
        answers: { member: [["Ann"], {}] },
      }),
    ).toBe(null);
  });
});

describe("public form draft storage failures", () => {
  test("write and remove swallow storage errors", () => {
    try {
      mockWindowWithStorage({
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {
          throw new Error("SecurityError");
        },
      });
      const form = createForm([
        createBlock({ id: "a", type: "SHORT_TEXT", position: 0 }),
      ]);
      const draft = createPublicFormDraft(form, {
        answers: {},
        history: ["a"],
        cursor: 0,
      });

      let threw = false;
      try {
        writeStoredPublicFormDraft("key", draft);
        removeStoredPublicFormDraft("key");
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    } finally {
      restoreWindow();
    }
  });

  test("a stored value that parses but fails the schema is invalid, an empty one is missing", () => {
    try {
      mockWindowWithStorage({ getItem: () => JSON.stringify({ version: 1 }) });
      expect(readStoredPublicFormDraft("k").status).toBe("invalid");

      mockWindowWithStorage({ getItem: () => "" });
      expect(readStoredPublicFormDraft("k").status).toBe("missing");

      mockWindowWithStorage({ getItem: () => "null" });
      expect(readStoredPublicFormDraft("k").status).toBe("invalid");
    } finally {
      restoreWindow();
    }
  });

  test("storage key is namespaced per form", () => {
    expect(getPublicFormDraftStorageKey("form-1")).toBe(
      `${PUBLIC_FORM_DRAFT_STORAGE_PREFIX}:form-1`,
    );
    expect(
      getPublicFormDraftStorageKey("form-1") !==
        getPublicFormDraftStorageKey("form-10"),
    ).toBe(true);
  });
});
