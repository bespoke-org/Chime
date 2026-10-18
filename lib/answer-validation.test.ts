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

function numberBlock(overrides: { allowFloat?: boolean; required?: boolean }) {
  return createBlock({
    id: "amount",
    type: "NUMBER",
    required: overrides.required ?? true,
    config: {
      placeholder: "",
      allowFloat: overrides.allowFloat ?? false,
      min: null,
      max: null,
      branchRules: [],
      defaultNextBlockId: null,
    },
  });
}

function linkBlock() {
  return createBlock({
    id: "site",
    type: "LINK",
    required: true,
    config: { placeholder: "", branchRules: [], defaultNextBlockId: null },
  });
}

function dateBlock() {
  return createBlock({
    id: "when",
    type: "DATE",
    required: true,
    config: { branchRules: [], defaultNextBlockId: null },
  });
}

function expectError(
  result: ReturnType<typeof validateAndNormalizeAnswer>,
  code: string,
) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
  }
}

function expectValue(
  result: ReturnType<typeof validateAndNormalizeAnswer>,
  value: string | string[] | undefined,
) {
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(JSON.stringify(result.value)).toBe(JSON.stringify(value));
  }
}

describe("validateAndNormalizeAnswer number edge cases", () => {
  test("accepts a comma as the decimal separator", () => {
    expectValue(
      validateAndNormalizeAnswer(numberBlock({ allowFloat: true }), "12,5"),
      "12.5",
    );
  });

  test("rejects a comma decimal when floats are disabled", () => {
    expectError(
      validateAndNormalizeAnswer(numberBlock({}), "12,5"),
      "whole_number_required",
    );
  });

  test("rejects number literals that are not plain decimals", () => {
    for (const raw of ["0x10", "1e3", "Infinity", "1_000", "1 000", "0b11"]) {
      expectError(
        validateAndNormalizeAnswer(numberBlock({}), raw),
        "invalid_number",
      );
    }
  });

  test("normalizes negative zero to zero", () => {
    expectValue(validateAndNormalizeAnswer(numberBlock({}), "-0"), "0");
  });

  test("keeps integers above the float precision limit intact", () => {
    expectValue(
      validateAndNormalizeAnswer(numberBlock({}), "9007199254740993"),
      "9007199254740993",
    );
  });

  test("drops leading zeros and trailing fraction zeros", () => {
    expectValue(validateAndNormalizeAnswer(numberBlock({}), "007"), "7");
    expectValue(
      validateAndNormalizeAnswer(numberBlock({ allowFloat: true }), "1.50"),
      "1.5",
    );
  });

  test("treats a numeric value sent as a non-string as empty", () => {
    expectError(
      validateAndNormalizeAnswer(numberBlock({}), 42),
      "answer_required",
    );
    expectValue(
      validateAndNormalizeAnswer(numberBlock({ required: false }), 42),
      undefined,
    );
  });
});

describe("validateAndNormalizeAnswer link edge cases", () => {
  test("lowercases scheme and host", () => {
    expectValue(
      validateAndNormalizeAnswer(linkBlock(), "HTTPS://EXAMPLE.com/Path"),
      "https://example.com/Path",
    );
  });

  test("rejects links with embedded credentials", () => {
    expectError(
      validateAndNormalizeAnswer(
        linkBlock(),
        "https://user:secret@example.com",
      ),
      "invalid_link",
    );
  });

  test("rejects non-http schemes and schemeless hosts", () => {
    for (const raw of [
      "javascript:alert(1)",
      "ftp://example.com",
      "mailto:a@b.c",
      "example.com",
      "//example.com",
    ]) {
      expectError(validateAndNormalizeAnswer(linkBlock(), raw), "invalid_link");
    }
  });

  test("rejects links with whitespace inside the host", () => {
    expectError(
      validateAndNormalizeAnswer(linkBlock(), "https://exa mple.com"),
      "invalid_link",
    );
  });

  test("converts unicode hosts to punycode", () => {
    expectValue(
      validateAndNormalizeAnswer(linkBlock(), "https://пример.рф"),
      "https://xn--e1afmkfd.xn--p1ai/",
    );
  });
});

describe("validateAndNormalizeAnswer date edge cases", () => {
  test("accepts February 29 only in leap years", () => {
    expectValue(
      validateAndNormalizeAnswer(dateBlock(), "2024-02-29"),
      "2024-02-29",
    );
    expectError(
      validateAndNormalizeAnswer(dateBlock(), "2023-02-29"),
      "invalid_date",
    );
    expectError(
      validateAndNormalizeAnswer(dateBlock(), "1900-02-29"),
      "invalid_date",
    );
  });

  test("rejects dates outside the ISO calendar format", () => {
    for (const raw of [
      "2024-2-5",
      "05.02.2024",
      "2024-13-01",
      "2024-04-31",
      "2024-02-29T00:00:00Z",
      "20240229",
    ]) {
      expectError(validateAndNormalizeAnswer(dateBlock(), raw), "invalid_date");
    }
  });

  test("accepts the extremes of the four-digit year range", () => {
    expectValue(
      validateAndNormalizeAnswer(dateBlock(), "0001-01-01"),
      "0001-01-01",
    );
    expectValue(
      validateAndNormalizeAnswer(dateBlock(), "9999-12-31"),
      "9999-12-31",
    );
  });
});

describe("validateAndNormalizeAnswer choice edge cases", () => {
  test("rejects a single string sent for a multiple-choice question", () => {
    const block = createBlock({ id: "colors", type: "MULTIPLE_CHOICE" });

    expectError(validateAndNormalizeAnswer(block, "red"), "invalid_option");
  });

  test("rejects an array sent for a single-choice question", () => {
    const block = createBlock({ id: "choice", type: "SINGLE_CHOICE" });

    expectError(validateAndNormalizeAnswer(block, ["yes"]), "invalid_option");
  });

  test("treats a wrongly shaped empty value as no answer", () => {
    const single = createBlock({ id: "choice", type: "SINGLE_CHOICE" });
    const multi = createBlock({ id: "colors", type: "MULTIPLE_CHOICE" });

    expectValue(validateAndNormalizeAnswer(single, []), undefined);
    expectValue(validateAndNormalizeAnswer(multi, ""), undefined);
  });

  test("trims multiple-choice values and ignores non-string entries", () => {
    const block = createBlock({ id: "colors", type: "MULTIPLE_CHOICE" });

    expectValue(
      validateAndNormalizeAnswer(block, [" red ", 7, null, "blue", "  "]),
      ["red", "blue"],
    );
  });

  test("matches options case-sensitively", () => {
    const block = createBlock({ id: "choice", type: "SINGLE_CHOICE" });

    expectError(validateAndNormalizeAnswer(block, "Yes"), "invalid_option");
  });

  test("rejects one invalid value even when the rest are valid", () => {
    const block = createBlock({ id: "colors", type: "MULTIPLE_CHOICE" });

    expectError(
      validateAndNormalizeAnswer(block, ["red", "purple"]),
      "invalid_option",
    );
  });
});

describe("validateAndNormalizeAnswer text and agreement edge cases", () => {
  test("treats non-string text input as empty", () => {
    const block = createBlock({
      id: "name",
      type: "SHORT_TEXT",
      required: true,
    });

    expectError(validateAndNormalizeAnswer(block, 42), "answer_required");
    expectError(validateAndNormalizeAnswer(block, { a: 1 }), "answer_required");
    expectError(validateAndNormalizeAnswer(block, null), "answer_required");
  });

  test("treats whitespace-only text as empty", () => {
    const block = createBlock({
      id: "name",
      type: "SHORT_TEXT",
      required: true,
    });

    expectError(validateAndNormalizeAnswer(block, " \n\t "), "answer_required");
  });

  test("applies the regex to the trimmed value as a substring match", () => {
    const block = createBlock({
      id: "code",
      type: "SHORT_TEXT",
      config: {
        placeholder: "",
        validationRegex: "\\d+",
        branchRules: [],
        defaultNextBlockId: null,
      },
    });

    expectValue(validateAndNormalizeAnswer(block, " abc123 "), "abc123");
  });

  test("skips the regex when the optional answer is empty", () => {
    const block = createBlock({
      id: "code",
      type: "SHORT_TEXT",
      config: {
        placeholder: "",
        validationRegex: "^[A-Z]+$",
        branchRules: [],
        defaultNextBlockId: null,
      },
    });

    expectValue(validateAndNormalizeAnswer(block, ""), undefined);
  });

  test("rejects agreement values that differ only by case or whitespace inside", () => {
    const block = createBlock({
      id: "terms",
      type: "AGREEMENT",
      required: true,
    });

    expectError(
      validateAndNormalizeAnswer(block, "AGREED"),
      "invalid_agreement",
    );
    expectError(
      validateAndNormalizeAnswer(block, "not agreed"),
      "invalid_agreement",
    );
    expectValue(validateAndNormalizeAnswer(block, " agreed "), "agreed");
  });

  test("keeps an explicit refusal on an optional agreement", () => {
    const block = createBlock({ id: "terms", type: "AGREEMENT" });

    expectValue(validateAndNormalizeAnswer(block, "not_agreed"), "not_agreed");
  });

  test("returns no value for a text block regardless of input", () => {
    const block = createBlock({ id: "intro", type: "TEXT" });

    expectValue(validateAndNormalizeAnswer(block, "anything"), undefined);
  });
});

function ratingBlock(overrides: {
  min?: 0 | 1;
  max?: number;
  required?: boolean;
}) {
  return createBlock({
    id: "score",
    type: "RATING",
    required: overrides.required ?? true,
    config: {
      min: overrides.min ?? 1,
      max: overrides.max ?? 5,
      minLabel: "",
      maxLabel: "",
      branchRules: [],
      defaultNextBlockId: null,
    },
  });
}

describe("validateAndNormalizeAnswer rating", () => {
  test("accepts both ends of the scale", () => {
    expectValue(validateAndNormalizeAnswer(ratingBlock({}), "1"), "1");
    expectValue(validateAndNormalizeAnswer(ratingBlock({}), "5"), "5");
    expectValue(
      validateAndNormalizeAnswer(ratingBlock({ min: 0, max: 10 }), "0"),
      "0",
    );
    expectValue(
      validateAndNormalizeAnswer(ratingBlock({ min: 0, max: 10 }), "10"),
      "10",
    );
  });

  test("rejects values just outside the scale", () => {
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), "0"),
      "number_below_min",
    );
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), "6"),
      "number_above_max",
    );
    expectError(
      validateAndNormalizeAnswer(ratingBlock({ min: 0, max: 10 }), "-1"),
      "number_below_min",
    );
    expectError(
      validateAndNormalizeAnswer(ratingBlock({ min: 0, max: 10 }), "11"),
      "number_above_max",
    );
  });

  test("reports the configured bounds in range errors", () => {
    const below = validateAndNormalizeAnswer(ratingBlock({ min: 0 }), "-3");
    const above = validateAndNormalizeAnswer(ratingBlock({ max: 7 }), "8");

    expect(
      !below.ok && below.error.code === "number_below_min"
        ? below.error.min
        : null,
    ).toBe(0);
    expect(
      !above.ok && above.error.code === "number_above_max"
        ? above.error.max
        : null,
    ).toBe(7);
  });

  test("rejects fractional ratings", () => {
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), "3.5"),
      "whole_number_required",
    );
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), "3,5"),
      "whole_number_required",
    );
  });

  test("normalizes decimal separators, zero fractions and whitespace", () => {
    expectValue(validateAndNormalizeAnswer(ratingBlock({}), "3,0"), "3");
    expectValue(validateAndNormalizeAnswer(ratingBlock({}), " 4 "), "4");
    expectValue(validateAndNormalizeAnswer(ratingBlock({}), "04"), "4");
  });

  test("rejects values that are not plain numbers", () => {
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), "five"),
      "invalid_number",
    );
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), "1e0"),
      "invalid_number",
    );
  });

  test("treats non-string input as an empty answer", () => {
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), 4),
      "answer_required",
    );
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), ["4"]),
      "answer_required",
    );
    expectValue(
      validateAndNormalizeAnswer(ratingBlock({ required: false }), 4),
      undefined,
    );
  });

  test("requires an answer only when the block is required", () => {
    expectError(
      validateAndNormalizeAnswer(ratingBlock({}), "   "),
      "answer_required",
    );
    expectValue(
      validateAndNormalizeAnswer(ratingBlock({ required: false }), ""),
      undefined,
    );
  });
});

describe("validateAndNormalizeAnswer file upload", () => {
  const config = {
    accept: "any",
    maxSizeMb: 10,
    branchRules: [],
    defaultNextBlockId: null,
  };

  test("requires an upload id when the block is required", () => {
    const block = createBlock({
      id: "cv",
      type: "FILE_UPLOAD",
      required: true,
      config,
    });

    expect(JSON.stringify(validateAndNormalizeAnswer(block, ""))).toBe(
      JSON.stringify({ ok: false, error: { code: "answer_required" } }),
    );
    expect(JSON.stringify(validateAndNormalizeAnswer(block, undefined))).toBe(
      JSON.stringify({ ok: false, error: { code: "answer_required" } }),
    );
  });

  test("accepts an empty answer when optional and keeps a well-formed id", () => {
    const block = createBlock({ id: "cv", type: "FILE_UPLOAD", config });

    expect(JSON.stringify(validateAndNormalizeAnswer(block, "  "))).toBe(
      JSON.stringify({ ok: true }),
    );
    expect(
      JSON.stringify(validateAndNormalizeAnswer(block, " 7f3a9c0b1d2e ")),
    ).toBe(JSON.stringify({ ok: true, value: "7f3a9c0b1d2e" }));
  });

  test("rejects values that are not an upload id", () => {
    const block = createBlock({ id: "cv", type: "FILE_UPLOAD", config });

    for (const value of ["../x", "a b", "x".repeat(65), ["id"]]) {
      expect(JSON.stringify(validateAndNormalizeAnswer(block, value))).toBe(
        JSON.stringify({ ok: false, error: { code: "invalid_file" } }),
      );
    }
  });
});
