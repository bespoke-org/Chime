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
  validatePublicFormDraft,
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
    slug: "demo-form",
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

describe("public form draft validation", () => {
  test("restores a valid linear draft", () => {
    const form = createForm([
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({ id: "name", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "notes", type: "LONG_TEXT", position: 2 }),
    ]);
    const draft = createPublicFormDraft(form, {
      answers: { name: "Ada", notes: "Hello" },
      history: ["intro", "name", "notes"],
      cursor: 2,
    });

    const result = validatePublicFormDraft(form, draft);

    expect(result.status).toBe("restored");
    if (result.status !== "restored") {
      return;
    }

    expect(JSON.stringify(result.draft.history)).toBe(
      JSON.stringify(["intro", "name", "notes"]),
    );
    expect(result.draft.cursor).toBe(2);
    expect(JSON.stringify(result.draft.answers)).toBe(
      JSON.stringify({ name: "Ada", notes: "Hello" }),
    );
  });

  test("truncates future history to the active cursor when restoring", () => {
    const form = createForm([
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({ id: "email", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "notes", type: "LONG_TEXT", position: 2 }),
    ]);
    const draft = createPublicFormDraft(form, {
      answers: { email: "me@example.com", notes: "Saved later step" },
      history: ["intro", "email", "notes"],
      cursor: 1,
    });

    const result = validatePublicFormDraft(form, draft);

    expect(result.status).toBe("restored");
    if (result.status !== "restored") {
      return;
    }

    expect(JSON.stringify(result.draft.history)).toBe(
      JSON.stringify(["intro", "email"]),
    );
    expect(result.draft.cursor).toBe(1);
  });

  test("marks drafts stale when the form fingerprint changes", () => {
    const initialForm = createForm([
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({ id: "name", type: "SHORT_TEXT", position: 1 }),
    ]);
    const changedForm = createForm([
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({
        id: "name",
        type: "SHORT_TEXT",
        position: 1,
        required: true,
      }),
    ]);
    const draft = createPublicFormDraft(initialForm, {
      answers: { name: "Ada" },
      history: ["intro", "name"],
      cursor: 1,
    });

    const result = validatePublicFormDraft(changedForm, draft);

    expect(JSON.stringify(result)).toBe(JSON.stringify({ status: "stale" }));
  });

  test("returns invalid for malformed stored draft json", () => {
    try {
      mockWindowWithStorage({
        getItem: () => "{not valid json",
      });

      const result = readStoredPublicFormDraft("form-1");

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({ status: "invalid" }),
      );
    } finally {
      restoreWindow();
    }
  });

  test("returns unavailable when localStorage access throws", () => {
    try {
      mockWindowWithStorage({
        getItem: () => {
          throw new Error("Storage disabled");
        },
      });

      const result = readStoredPublicFormDraft("form-1");

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({ status: "unavailable" }),
      );
    } finally {
      restoreWindow();
    }
  });

  test("rejects drafts whose saved route does not match branching", () => {
    const form = createForm([
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "follow-up" },
          ],
          defaultNextBlockId: "fallback",
        },
      }),
      createBlock({ id: "fallback", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "follow-up", type: "SHORT_TEXT", position: 2 }),
    ]);
    const draft = createPublicFormDraft(form, {
      answers: { path: "yes" },
      history: ["path", "fallback"],
      cursor: 1,
    });

    const result = validatePublicFormDraft(form, draft);

    expect(JSON.stringify(result)).toBe(JSON.stringify({ status: "invalid" }));
  });
});

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

  test("drops answers for blocks that are not in the form when restoring", () => {
    const result = validatePublicFormDraft(
      form,
      validDraft({ answers: { choice: "yes", ghost: "boo", other: ["x"] } }),
    );

    expect(result.status).toBe("restored");
    if (result.status !== "restored") {
      return;
    }

    expect(JSON.stringify(result.draft.answers)).toBe(
      JSON.stringify({ choice: "yes" }),
    );
  });

  test("keeps an answer whose shape does not fit the block for later validation", () => {
    const result = validatePublicFormDraft(
      form,
      validDraft({ answers: { choice: ["yes"] } }),
    );

    expect(result.status).toBe("restored");
    if (result.status !== "restored") {
      return;
    }

    expect(JSON.stringify(result.draft.answers)).toBe(
      JSON.stringify({ choice: ["yes"] }),
    );
  });

  test("rejects a cursor past the history and a history that does not start at the first block", () => {
    expect(
      validatePublicFormDraft(form, validDraft({ cursor: 2 })).status,
    ).toBe("invalid");
    expect(
      validatePublicFormDraft(form, validDraft({ history: [] })).status,
    ).toBe("invalid");
    expect(
      validatePublicFormDraft(
        form,
        validDraft({ history: ["choice", "notes"] }),
      ).status,
    ).toBe("invalid");
  });

  test("rejects a history that references a block no longer in the form", () => {
    expect(
      validatePublicFormDraft(
        form,
        validDraft({ history: ["intro", "removed"], cursor: 1 }),
      ).status,
    ).toBe("invalid");
  });

  test("treats a draft for another form as stale", () => {
    expect(
      validatePublicFormDraft(form, validDraft({ formId: "form-2" })).status,
    ).toBe("stale");
  });

  test("restores an empty form only from an empty draft", () => {
    const emptyForm = createForm([]);
    const draft = createPublicFormDraft(emptyForm, {
      answers: {},
      history: [],
      cursor: 0,
    });

    expect(validatePublicFormDraft(emptyForm, draft).status).toBe("restored");
    expect(
      validatePublicFormDraft(emptyForm, { ...draft, history: ["x"] }).status,
    ).toBe("invalid");
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
