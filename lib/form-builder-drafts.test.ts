import { describe, expect, test } from "bun:test";

import {
  FORM_BUILDER_DRAFT_STORAGE_PREFIX,
  FORM_BUILDER_DRAFT_VERSION,
  createBranchRuleDrafts,
  createChoiceOptionDrafts,
  createDefaultBranchRuleDraft,
  createFormBuilderDraft,
  fromDateTimeLocalValue,
  getFormBuilderDraftStorageKey,
  hasBuilderBlockDraftChanges,
  parseMaxResponsesDraft,
  readStoredFormBuilderDraft,
  removeStoredFormBuilderDraft,
  serializeBranchRuleDrafts,
  serializeChoiceOptionDrafts,
  toDateTimeLocalValue,
  writeStoredFormBuilderDraft,
} from "@/lib/form-builder-drafts";
import { getDefaultBlockConfig } from "@/lib/blocks";
import type { BuilderBlock } from "@/lib/form-types";

function createBlock(
  overrides: Partial<BuilderBlock> &
    Pick<BuilderBlock, "id" | "type" | "position">,
): BuilderBlock {
  const now = new Date("2026-04-14T12:00:00.000Z");

  return {
    formId: "form-1",
    title: "",
    description: "",
    required: false,
    createdAt: now,
    updatedAt: now,
    config: getDefaultBlockConfig(overrides.type),
    ...overrides,
  } as BuilderBlock;
}

describe("form builder draft helpers", () => {
  test("preserves choice option order when drafts are saved back into block config", () => {
    const drafts = createChoiceOptionDrafts(["First", "Second", "Third"]);

    expect(JSON.stringify(serializeChoiceOptionDrafts(drafts))).toBe(
      JSON.stringify(["First", "Second", "Third"]),
    );
  });

  test("preserves branch rule operator, value, and target when drafts are saved", () => {
    const serialized = serializeBranchRuleDrafts([
      {
        id: "draft-1",
        operator: "contains",
        value: "vip",
        targetBlockId: "priority-review",
      },
    ]);

    expect(JSON.stringify(serialized)).toBe(
      JSON.stringify([
        {
          operator: "contains",
          value: "vip",
          targetBlockId: "priority-review",
        },
      ]),
    );
  });

  test("starts agreement branch rules with the agreed answer as the default value", () => {
    const draft = createDefaultBranchRuleDraft({
      blockType: "AGREEMENT",
      targetBlockId: "accepted",
    });

    expect(draft.operator).toBe("equals");
    expect(draft.value).toBe("agreed");
    expect(draft.targetBlockId).toBe("accepted");
  });

  test("treats choice drafts with regenerated ids as unchanged when the saved content matches", () => {
    const savedBlock = createBlock({
      id: "choice-1",
      type: "SINGLE_CHOICE",
      position: 0,
      title: "Pick one",
      config: {
        ...getDefaultBlockConfig("SINGLE_CHOICE"),
        options: ["Yes", "No"],
      },
    });

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: createChoiceOptionDrafts(["Yes", "No"]),
        branchRulesDraft: [],
      }),
    ).toBe(false);

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: createChoiceOptionDrafts(["Yes", "Maybe"]),
        branchRulesDraft: [],
      }),
    ).toBe(true);
  });

  test("counts a draft that fails the block schema as changed", () => {
    const savedBlock = createBlock({
      id: "name",
      type: "SHORT_TEXT",
      position: 0,
    });

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: {
          ...savedBlock,
          config: { ...savedBlock.config, validationRegex: "(" },
        } as BuilderBlock,
        choiceOptionsDraft: [],
        branchRulesDraft: [],
      }),
    ).toBe(true);
  });

  test("detects branching edits from serialized rule content instead of draft ids", () => {
    const savedBlock = createBlock({
      id: "question-1",
      type: "SHORT_TEXT",
      position: 0,
      title: "Why?",
      config: {
        ...getDefaultBlockConfig("SHORT_TEXT"),
        branchRules: [
          {
            operator: "contains",
            value: "vip",
            targetBlockId: "priority-review",
          },
        ],
      },
    });

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: [],
        branchRulesDraft: createBranchRuleDrafts([
          {
            operator: "contains",
            value: "vip",
            targetBlockId: "priority-review",
          },
        ]),
      }),
    ).toBe(false);

    expect(
      hasBuilderBlockDraftChanges({
        savedBlock,
        blockDraft: savedBlock,
        choiceOptionsDraft: [],
        branchRulesDraft: createBranchRuleDrafts([
          {
            operator: "contains",
            value: "vip-only",
            targetBlockId: "priority-review",
          },
        ]),
      }),
    ).toBe(true);
  });
});

describe("closing draft helpers", () => {
  test("round-trips a datetime-local value through ISO", () => {
    const local = "2030-05-06T07:08";
    const iso = fromDateTimeLocalValue(local);

    expect(iso).toBe(new Date(local).toISOString());
    expect(toDateTimeLocalValue(iso)).toBe(local);
  });

  test("maps empty and invalid values", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue("nonsense")).toBe("");
    expect(fromDateTimeLocalValue("   ")).toBe(null);
    expect(fromDateTimeLocalValue("nonsense")).toBe("nonsense");
  });

  test("parses the response limit draft", () => {
    expect(parseMaxResponsesDraft("")).toBe(null);
    expect(parseMaxResponsesDraft(" 25 ")).toBe(25);
    expect(Number.isNaN(parseMaxResponsesDraft("abc") as number)).toBe(true);
  });
});

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

describe("local builder draft persistence", () => {
  test("round-trips blocks with their pages through localStorage", () => {
    try {
      const store = new Map<string, string>();
      mockWindowWithStorage({
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => void store.set(key, value),
        removeItem: (key) => void store.delete(key),
      });

      expect(getFormBuilderDraftStorageKey("form-1")).toBe(
        `${FORM_BUILDER_DRAFT_STORAGE_PREFIX}:form-1`,
      );

      writeStoredFormBuilderDraft(
        getFormBuilderDraftStorageKey("form-1"),
        createFormBuilderDraft({
          formId: "form-1",
          blocks: [
            {
              ...createBlock({
                id: "name",
                type: "SHORT_TEXT",
                position: 0,
              }),
              pageId: "page-1",
            },
          ],
          pages: [{ id: "page-1" }, { id: "page-2" }],
        }),
      );

      const result = readStoredFormBuilderDraft(
        getFormBuilderDraftStorageKey("form-1"),
      );

      expect(result.status).toBe("ok");
      if (result.status !== "ok") {
        return;
      }

      expect(result.draft.version).toBe(FORM_BUILDER_DRAFT_VERSION);
      expect(result.draft.formId).toBe("form-1");
      expect(result.draft.blocks[0]?.pageId).toBe("page-1");
      expect(JSON.stringify(result.draft.pages)).toBe(
        JSON.stringify([{ id: "page-1" }, { id: "page-2" }]),
      );
    } finally {
      restoreWindow();
    }
  });

  test("loads a draft saved before pages existed as a draft without pages", () => {
    try {
      const legacyDraft = createFormBuilderDraft({
        formId: "form-1",
        blocks: [
          createBlock({ id: "name", type: "SHORT_TEXT", position: 0 }),
          createBlock({ id: "notes", type: "LONG_TEXT", position: 1 }),
        ],
      });
      mockWindowWithStorage({
        getItem: () => JSON.stringify(legacyDraft),
      });

      const result = readStoredFormBuilderDraft(
        getFormBuilderDraftStorageKey("form-1"),
      );

      expect(result.status).toBe("ok");
      if (result.status !== "ok") {
        return;
      }

      expect("pages" in result.draft).toBe(false);
      expect(result.draft.blocks.map((block) => block.id)).toEqual([
        "name",
        "notes",
      ]);
    } finally {
      restoreWindow();
    }
  });

  test("drops malformed page entries but keeps the draft", () => {
    try {
      mockWindowWithStorage({
        getItem: () =>
          JSON.stringify({
            version: FORM_BUILDER_DRAFT_VERSION,
            formId: "form-1",
            savedAt: 1000,
            blocks: [{ id: "name" }],
            pages: [{ id: "page-1" }, "junk", {}],
          }),
      });

      const result = readStoredFormBuilderDraft(
        getFormBuilderDraftStorageKey("form-1"),
      );

      expect(result.status).toBe("ok");
      if (result.status !== "ok") {
        return;
      }

      expect(JSON.stringify(result.draft.pages)).toBe(
        JSON.stringify([{ id: "page-1" }]),
      );
    } finally {
      restoreWindow();
    }
  });

  test("reports a missing, invalid or unavailable draft", () => {
    try {
      mockWindowWithStorage({ getItem: () => null });
      expect(readStoredFormBuilderDraft("k").status).toBe("missing");

      mockWindowWithStorage({ getItem: () => "{not valid json" });
      expect(readStoredFormBuilderDraft("k").status).toBe("invalid");

      mockWindowWithStorage({
        getItem: () =>
          JSON.stringify({
            version: FORM_BUILDER_DRAFT_VERSION + 1,
            formId: "form-1",
            savedAt: 1000,
            blocks: [],
          }),
      });
      expect(readStoredFormBuilderDraft("k").status).toBe("invalid");

      mockWindowWithStorage({
        getItem: () =>
          JSON.stringify({
            version: FORM_BUILDER_DRAFT_VERSION,
            formId: "form-1",
            savedAt: 1000,
            blocks: "not-an-array",
          }),
      });
      expect(readStoredFormBuilderDraft("k").status).toBe("invalid");

      mockWindowWithStorage({
        getItem: () => {
          throw new Error("Storage disabled");
        },
      });
      expect(readStoredFormBuilderDraft("k").status).toBe("unavailable");
    } finally {
      restoreWindow();
    }
  });

  test("ignores write and remove failures", () => {
    try {
      mockWindowWithStorage({
        getItem: () => null,
        setItem: () => {
          throw new Error("Storage disabled");
        },
        removeItem: () => {
          throw new Error("Storage disabled");
        },
      });

      let threw = false;
      try {
        writeStoredFormBuilderDraft(
          "k",
          createFormBuilderDraft({ formId: "form-1", blocks: [] }),
        );
        removeStoredFormBuilderDraft("k");
      } catch {
        threw = true;
      }

      expect(threw).toBe(false);
    } finally {
      restoreWindow();
    }
  });
});
