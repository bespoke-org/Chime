import { describe, expect, test } from "bun:test";

import {
  branchOperatorValues,
  branchRuleSchema,
  getDefaultBlockConfig,
  getRatingValues,
  getSupportedBranchOperators,
  getVisibleBranchOperators,
  parseBlockConfig,
  type BlockConfig,
} from "@/lib/blocks";
import { normalizeBlockConfig } from "@/lib/block-config-normalization";
import type { AppLocale } from "@/lib/i18n";

function throws(fn: () => unknown) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function limits(config: BlockConfig) {
  return "min" in config && "max" in config
    ? json({ min: config.min, max: config.max })
    : "";
}

function optionsOf(config: BlockConfig) {
  return "options" in config ? json(config.options) : "";
}

describe("number block limits", () => {
  test("rejects a minimum above the maximum", () => {
    expect(throws(() => parseBlockConfig("NUMBER", { min: 10, max: 5 }))).toBe(
      true,
    );
  });

  test("accepts equal minimum and maximum", () => {
    expect(limits(parseBlockConfig("NUMBER", { min: 5, max: 5 }))).toBe(
      json({ min: 5, max: 5 }),
    );
  });

  test("rejects fractional limits when floats are disabled", () => {
    expect(
      throws(() => parseBlockConfig("NUMBER", { allowFloat: false, min: 1.5 })),
    ).toBe(true);
    expect(
      throws(() =>
        parseBlockConfig("NUMBER", { allowFloat: false, max: "2.5" }),
      ),
    ).toBe(true);
    expect(
      limits(parseBlockConfig("NUMBER", { allowFloat: true, min: 1.5 })),
    ).toBe(json({ min: 1.5, max: null }));
  });

  test("treats empty, null and undefined limits as unset", () => {
    expect(limits(parseBlockConfig("NUMBER", { min: "", max: "   " }))).toBe(
      json({ min: null, max: null }),
    );
    expect(limits(parseBlockConfig("NUMBER", { min: null }))).toBe(
      json({ min: null, max: null }),
    );
    expect(limits(parseBlockConfig("NUMBER", {}))).toBe(
      json({ min: null, max: null }),
    );
  });

  test("rejects limits that are not plain decimals", () => {
    for (const raw of ["abc", "1e3", "0x10", "Infinity", "1_000"]) {
      expect(throws(() => parseBlockConfig("NUMBER", { min: raw }))).toBe(true);
    }
    expect(throws(() => parseBlockConfig("NUMBER", { min: Number.NaN }))).toBe(
      true,
    );
    expect(
      throws(() =>
        parseBlockConfig("NUMBER", { min: Number.POSITIVE_INFINITY }),
      ),
    ).toBe(true);
    expect(throws(() => parseBlockConfig("NUMBER", { min: true }))).toBe(true);
  });

  test("accepts a comma as the decimal separator in limits", () => {
    expect(
      limits(parseBlockConfig("NUMBER", { allowFloat: true, min: "12,5" })),
    ).toBe(json({ min: 12.5, max: null }));
  });

  test("keeps very large limits", () => {
    expect(limits(parseBlockConfig("NUMBER", { max: "1000000000000" }))).toBe(
      json({ min: null, max: 1_000_000_000_000 }),
    );
  });
});

describe("short text identity key", () => {
  function keyOf(value: unknown) {
    const config = parseBlockConfig("SHORT_TEXT", {
      identity: true,
      identityKey: value,
    });
    return "identityKey" in config ? config.identityKey : undefined;
  }

  test("keeps a trimmed snake_case key", () => {
    expect(keyOf(" telegram_handle ")).toBe("telegram_handle");
  });

  test("stores an empty or non-string key as null", () => {
    expect(keyOf("  ")).toBe(null);
    expect(keyOf(7)).toBe(null);
  });

  test("rejects a key that is not lowercase snake_case", () => {
    expect(throws(() => keyOf("Telegram"))).toBe(true);
    expect(throws(() => keyOf("1st"))).toBe(true);
    expect(throws(() => keyOf("vk-id"))).toBe(true);
  });
});

describe("text block regex pattern", () => {
  function regexOf(value: unknown) {
    const config = parseBlockConfig("SHORT_TEXT", { validationRegex: value });
    return "validationRegex" in config ? config.validationRegex : undefined;
  }

  test("rejects a pattern that does not compile", () => {
    expect(throws(() => regexOf("("))).toBe(true);
    expect(throws(() => regexOf("[a-"))).toBe(true);
  });

  test("stores a whitespace-only or non-string pattern as null", () => {
    expect(regexOf("   ")).toBe(null);
    expect(regexOf(42)).toBe(null);
    expect(regexOf(null)).toBe(null);
  });

  test("keeps slash-delimited syntax as a literal pattern", () => {
    expect(regexOf("/a/i")).toBe("/a/i");
  });

  test("accepts a long pattern", () => {
    const pattern = `^${"a".repeat(5000)}$`;
    expect(regexOf(pattern)).toBe(pattern);
  });
});

describe("choice block options", () => {
  test("collapses duplicate options after trimming", () => {
    const config = normalizeBlockConfig("SINGLE_CHOICE", {
      options: ["yes", " yes", "no", "no "],
    });

    expect(optionsOf(config)).toBe(json(["yes", "no"]));
  });

  test("keeps exactly two options", () => {
    const config = normalizeBlockConfig("MULTIPLE_CHOICE", {
      options: ["a", "b"],
    });

    expect(optionsOf(config)).toBe(json(["a", "b"]));
  });

  test("drops options beyond the tenth", () => {
    const options = Array.from({ length: 12 }, (_, index) => `o${index}`);
    const config = normalizeBlockConfig("SINGLE_CHOICE", { options });

    expect(optionsOf(config)).toBe(json(options.slice(0, 10)));
  });

  test("ignores non-string entries", () => {
    const config = normalizeBlockConfig("SINGLE_CHOICE", {
      options: ["a", 1, null, { label: "x" }, "b"],
    });

    expect(optionsOf(config)).toBe(json(["a", "b"]));
  });

  test("allows a pipe separator inside an option", () => {
    const config = normalizeBlockConfig("SINGLE_CHOICE", {
      options: ["a | b", "c"],
    });

    expect(optionsOf(config)).toBe(json(["a | b", "c"]));
  });

  test("rejects an option longer than 120 characters", () => {
    expect(
      throws(() =>
        normalizeBlockConfig("SINGLE_CHOICE", {
          options: ["a".repeat(121), "b"],
        }),
      ),
    ).toBe(true);
  });

  test("falls back to defaults when options are missing entirely", () => {
    expect(optionsOf(normalizeBlockConfig("SINGLE_CHOICE", {}))).toBe(
      json(["Option 1", "Option 2"]),
    );
    expect(optionsOf(normalizeBlockConfig("SINGLE_CHOICE", null))).toBe(
      json(["Option 1", "Option 2"]),
    );
  });

  test("strict parsing rejects fewer than two options", () => {
    expect(
      throws(() => parseBlockConfig("SINGLE_CHOICE", { options: ["only"] })),
    ).toBe(true);
  });
});

describe("branch rule settings", () => {
  test("rejects more than fifty rules", () => {
    const rules = Array.from({ length: 51 }, () => ({
      operator: "equals",
      value: "x",
      targetBlockId: "t",
    }));

    expect(
      throws(() => parseBlockConfig("SHORT_TEXT", { branchRules: rules })),
    ).toBe(true);
    expect(
      throws(() =>
        parseBlockConfig("SHORT_TEXT", { branchRules: rules.slice(0, 50) }),
      ),
    ).toBe(false);
  });

  test("rejects an unknown operator and an empty target", () => {
    expect(
      throws(() =>
        branchRuleSchema.parse({ operator: "matches", targetBlockId: "t" }),
      ),
    ).toBe(true);
    expect(
      throws(() =>
        branchRuleSchema.parse({ operator: "equals", targetBlockId: "  " }),
      ),
    ).toBe(true);
    expect(throws(() => branchRuleSchema.parse({ operator: "equals" }))).toBe(
      true,
    );
  });

  test("defaults operator to equals and trims the target", () => {
    expect(json(branchRuleSchema.parse({ targetBlockId: " t " }))).toBe(
      json({ operator: "equals", value: null, targetBlockId: "t" }),
    );
  });

  test("keeps only string operands and trims them", () => {
    expect(
      branchRuleSchema.parse({ value: " 5 ", targetBlockId: "t" }).value,
    ).toBe("5");
    expect(branchRuleSchema.parse({ value: 5, targetBlockId: "t" }).value).toBe(
      null,
    );
    expect(
      branchRuleSchema.parse({ value: "  ", targetBlockId: "t" }).value,
    ).toBe(null);
    expect(
      branchRuleSchema.parse({ value: ["a"], targetBlockId: "t" }).value,
    ).toBe(null);
  });

  test("treats an empty default next block as unset", () => {
    for (const raw of ["", "   ", null, undefined]) {
      const config = parseBlockConfig("NUMBER", { defaultNextBlockId: raw });
      expect(
        "defaultNextBlockId" in config ? config.defaultNextBlockId : undefined,
      ).toBe(null);
    }
  });

  test("requires endForm to be a boolean in strict parsing", () => {
    expect(throws(() => parseBlockConfig("NUMBER", { endForm: "true" }))).toBe(
      true,
    );
    expect(throws(() => parseBlockConfig("TEXT", { endForm: 1 }))).toBe(true);
  });

  test("coerces endForm for choice blocks during normalization", () => {
    const config = normalizeBlockConfig("SINGLE_CHOICE", {
      options: ["a", "b"],
      endForm: "yes",
    });

    expect("endForm" in config && config.endForm).toBe(true);
  });
});

describe("parseBlockConfig with stored data", () => {
  test("fills defaults for a config saved before branching existed", () => {
    expect(json(parseBlockConfig("SHORT_TEXT", { placeholder: "Name" }))).toBe(
      json({
        placeholder: "Name",
        validationRegex: null,
        identity: false,
        identityKey: null,
        branchRules: [],
        defaultNextBlockId: null,
        endForm: false,
      }),
    );
  });

  test("ignores fields that belong to another block type", () => {
    expect(
      json(parseBlockConfig("NUMBER", { options: ["a", "b"], body: "hello" })),
    ).toBe(
      json({
        placeholder: "42",
        allowFloat: false,
        min: null,
        max: null,
        branchRules: [],
        defaultNextBlockId: null,
        endForm: false,
      }),
    );
  });

  test("treats null and undefined as an empty config", () => {
    expect(json(parseBlockConfig("DATE", null))).toBe(
      json({ branchRules: [], defaultNextBlockId: null, endForm: false }),
    );
    expect(json(parseBlockConfig("AGREEMENT", undefined))).toBe(
      json({
        label: "I agree",
        branchRules: [],
        defaultNextBlockId: null,
        endForm: false,
      }),
    );
  });

  test("rejects a config that is not an object", () => {
    expect(throws(() => parseBlockConfig("SHORT_TEXT", "placeholder"))).toBe(
      true,
    );
    expect(throws(() => parseBlockConfig("SHORT_TEXT", ["a"]))).toBe(true);
    expect(throws(() => parseBlockConfig("TEXT", 7))).toBe(true);
  });

  test("enforces copy length limits", () => {
    expect(
      throws(() => parseBlockConfig("TEXT", { body: "x".repeat(2401) })),
    ).toBe(true);
    expect(
      throws(() =>
        parseBlockConfig("SHORT_TEXT", { placeholder: "x".repeat(121) }),
      ),
    ).toBe(true);
    expect(
      throws(() =>
        parseBlockConfig("LONG_TEXT", { placeholder: "x".repeat(241) }),
      ),
    ).toBe(true);
    expect(
      throws(() => parseBlockConfig("AGREEMENT", { label: "x".repeat(161) })),
    ).toBe(true);
  });
});

describe("branch operator support", () => {
  test("text blocks support no operators", () => {
    expect(json(getSupportedBranchOperators("TEXT"))).toBe("[]");
  });

  test("every supported operator is a known operator accepted by the rule schema", () => {
    const types = [
      "SHORT_TEXT",
      "LONG_TEXT",
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "NUMBER",
      "LINK",
      "AGREEMENT",
      "DATE",
    ] as const;

    for (const type of types) {
      const operators = getSupportedBranchOperators(type);
      expect(operators.length > 0).toBe(true);

      for (const operator of operators) {
        expect(branchOperatorValues).toContain(operator);
        expect(
          branchRuleSchema.parse({ operator, targetBlockId: "t" }).operator,
        ).toBe(operator);
      }
    }
  });

  test("comparison operators exist only for numbers and dates", () => {
    for (const type of ["NUMBER", "DATE"] as const) {
      for (const operator of ["gt", "gte", "lt", "lte"]) {
        expect(getSupportedBranchOperators(type)).toContain(operator);
      }
    }
    for (const type of ["SHORT_TEXT", "SINGLE_CHOICE", "AGREEMENT"] as const) {
      expect(getSupportedBranchOperators(type)).not.toContain("gt");
    }
  });
});

describe("localized block defaults", () => {
  test("uses russian copy for the ru locale", () => {
    expect(optionsOf(getDefaultBlockConfig("SINGLE_CHOICE", "ru"))).toBe(
      json(["Вариант 1", "Вариант 2"]),
    );
    const agreement = getDefaultBlockConfig("AGREEMENT", "ru");
    expect("label" in agreement && agreement.label).toBe("Я согласен");
  });

  test("falls back to english for an unknown locale", () => {
    const config = getDefaultBlockConfig(
      "SHORT_TEXT",
      "de" as unknown as AppLocale,
    );
    expect("placeholder" in config && config.placeholder).toBe(
      "Type your answer here…",
    );
  });

  test("date defaults carry no copy", () => {
    expect(json(getDefaultBlockConfig("DATE", "ru"))).toBe(
      json({ branchRules: [], defaultNextBlockId: null, endForm: false }),
    );
  });
});

describe("rating block config", () => {
  function rating(config: BlockConfig) {
    return "minLabel" in config
      ? json({
          min: config.min,
          max: config.max,
          minLabel: config.minLabel,
          maxLabel: config.maxLabel,
        })
      : "";
  }

  test("defaults to a 1 to 5 scale without labels", () => {
    expect(json(parseBlockConfig("RATING", {}))).toBe(
      json({
        min: 1,
        max: 5,
        minLabel: "",
        maxLabel: "",
        branchRules: [],
        defaultNextBlockId: null,
        endForm: false,
      }),
    );
  });

  test("accepts the NPS scale from 0 to 10", () => {
    expect(rating(parseBlockConfig("RATING", { min: 0, max: 10 }))).toBe(
      json({ min: 0, max: 10, minLabel: "", maxLabel: "" }),
    );
  });

  test("rejects a maximum that is not above the minimum", () => {
    expect(throws(() => parseBlockConfig("RATING", { min: 1, max: 1 }))).toBe(
      true,
    );
    expect(throws(() => parseBlockConfig("RATING", { min: 1, max: 0 }))).toBe(
      true,
    );
  });

  test("rejects values outside the supported scale", () => {
    expect(throws(() => parseBlockConfig("RATING", { max: 11 }))).toBe(true);
    expect(throws(() => parseBlockConfig("RATING", { max: 1 }))).toBe(true);
    expect(throws(() => parseBlockConfig("RATING", { min: 2 }))).toBe(true);
    expect(throws(() => parseBlockConfig("RATING", { min: -1 }))).toBe(true);
    expect(throws(() => parseBlockConfig("RATING", { max: 4.5 }))).toBe(true);
    expect(throws(() => parseBlockConfig("RATING", { max: "5" }))).toBe(true);
  });

  test("trims labels and caps them at 40 characters", () => {
    expect(
      rating(
        parseBlockConfig("RATING", {
          minLabel: "  Not likely  ",
          maxLabel: " Very likely ",
        }),
      ),
    ).toBe(
      json({ min: 1, max: 5, minLabel: "Not likely", maxLabel: "Very likely" }),
    );
    expect(
      rating(parseBlockConfig("RATING", { minLabel: ` ${"x".repeat(40)} ` })),
    ).toBe(json({ min: 1, max: 5, minLabel: "x".repeat(40), maxLabel: "" }));
    expect(
      throws(() => parseBlockConfig("RATING", { maxLabel: "x".repeat(41) })),
    ).toBe(true);
    expect(throws(() => parseBlockConfig("RATING", { minLabel: 3 }))).toBe(
      true,
    );
  });

  test("fills defaults for a stored config without labels", () => {
    expect(rating(parseBlockConfig("RATING", { min: 0, max: 7 }))).toBe(
      json({ min: 0, max: 7, minLabel: "", maxLabel: "" }),
    );
    expect(rating(parseBlockConfig("RATING", { min: null, max: null }))).toBe(
      json({ min: 1, max: 5, minLabel: "", maxLabel: "" }),
    );
  });

  test("ignores fields that belong to another block type", () => {
    expect(
      rating(
        parseBlockConfig("RATING", {
          options: ["a", "b"],
          placeholder: "42",
          allowFloat: true,
          label: "I agree",
        }),
      ),
    ).toBe(json({ min: 1, max: 5, minLabel: "", maxLabel: "" }));
  });

  test("keeps branch settings like other question blocks", () => {
    const config = parseBlockConfig("RATING", {
      branchRules: [{ operator: "gte", value: "4", targetBlockId: "happy" }],
      defaultNextBlockId: "neutral",
      endForm: true,
    });

    expect("branchRules" in config && config.branchRules.length).toBe(1);
    expect(
      "defaultNextBlockId" in config ? config.defaultNextBlockId : undefined,
    ).toBe("neutral");
    expect("endForm" in config && config.endForm).toBe(true);
  });

  test("supports the same branch operators as number blocks", () => {
    expect(json(getSupportedBranchOperators("RATING"))).toBe(
      json(getSupportedBranchOperators("NUMBER")),
    );
    expect(json(getVisibleBranchOperators("RATING"))).toBe(
      json(getVisibleBranchOperators("NUMBER")),
    );
  });

  test("lists every value on the scale", () => {
    const config = parseBlockConfig("RATING", { min: 0, max: 3 });
    expect("minLabel" in config ? json(getRatingValues(config)) : "").toBe(
      json([0, 1, 2, 3]),
    );
  });

  test("has the same defaults in every locale", () => {
    expect(json(getDefaultBlockConfig("RATING", "ru"))).toBe(
      json(getDefaultBlockConfig("RATING", "en")),
    );
  });
});

describe("file upload block operators", () => {
  test("branches only on presence", () => {
    expect(json(getSupportedBranchOperators("FILE_UPLOAD"))).toBe(
      json(["is_empty", "is_not_empty"]),
    );
    expect(json(getVisibleBranchOperators("FILE_UPLOAD"))).toBe(
      json(["is_empty", "is_not_empty"]),
    );
  });
});
