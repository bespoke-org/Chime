import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import type { PublicForm } from "@/lib/form-types";
import {
  createPublicFormDraft,
  readStoredPublicFormDraft,
  validatePublicFormDraft,
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
