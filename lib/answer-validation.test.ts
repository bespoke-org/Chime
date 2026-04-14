import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import { validateAndNormalizeAnswer } from "@/lib/answer-validation";

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
          : overrides.type === "MULTIPLE_CHOICE"
            ? {
                options: ["red", "blue", "green"],
                branchRules: [],
                defaultNextBlockId: null,
              }
            : overrides.type === "NUMBER"
              ? {
                  placeholder: "",
                  allowFloat: false,
                  min: null,
                  max: null,
                  branchRules: [],
                  defaultNextBlockId: null,
                }
              : overrides.type === "AGREEMENT"
                ? {
                    label: "I agree",
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

describe("validateAndNormalizeAnswer", () => {
  test("normalizes valid text answers", () => {
    const block = createBlock({
      id: "name",
      type: "SHORT_TEXT",
      required: true,
      config: {
        placeholder: "",
        validationRegex: null,
        branchRules: [],
        defaultNextBlockId: null,
      },
    });

    const result = validateAndNormalizeAnswer(block, "  Ada  ");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("Ada");
  });

  test("rejects text that does not match regex", () => {
    const block = createBlock({
      id: "code",
      type: "SHORT_TEXT",
      required: true,
      config: {
        placeholder: "",
        validationRegex: "^[A-Z]+$",
        branchRules: [],
        defaultNextBlockId: null,
      },
    });

    const result = validateAndNormalizeAnswer(block, "abc");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_text_format");
  });

  test("rejects invalid single-choice options", () => {
    const block = createBlock({ id: "choice", type: "SINGLE_CHOICE" });

    const result = validateAndNormalizeAnswer(block, "maybe");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_option");
  });

  test("deduplicates multiple-choice values", () => {
    const block = createBlock({ id: "colors", type: "MULTIPLE_CHOICE" });

    const result = validateAndNormalizeAnswer(block, ["red", "blue", "red"]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).toBe(JSON.stringify(["red", "blue"]));
  });

  test("normalizes valid links", () => {
    const block = createBlock({
      id: "site",
      type: "LINK",
      required: true,
      config: {
        placeholder: "",
        branchRules: [],
        defaultNextBlockId: null,
      },
    });

    const result = validateAndNormalizeAnswer(block, "https://example.com");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("https://example.com/");
  });

  test("enforces required agreement", () => {
    const block = createBlock({
      id: "terms",
      type: "AGREEMENT",
      required: true,
    });

    const result = validateAndNormalizeAnswer(block, "not_agreed");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("agreement_required");
  });

  test("validates number limits", () => {
    const block = createBlock({
      id: "age",
      type: "NUMBER",
      required: true,
      config: {
        placeholder: "",
        allowFloat: false,
        min: 18,
        max: 99,
        branchRules: [],
        defaultNextBlockId: null,
      },
    });

    const result = validateAndNormalizeAnswer(block, "17");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("number_below_min");
  });
});
