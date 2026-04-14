import { describe, expect, test } from "bun:test";

import { normalizeBlockConfig } from "@/lib/block-config-normalization";

describe("normalizeBlockConfig", () => {
  test("trims and filters choice options while preserving branch settings", () => {
    const config = normalizeBlockConfig("SINGLE_CHOICE", {
      options: ["  yes  ", "", " no ", "   "],
      branchRules: [
        { operator: "equals", value: "yes", targetBlockId: "follow-up" },
      ],
      defaultNextBlockId: "fallback",
    });

    expect("options" in config && JSON.stringify(config.options)).toBe(
      JSON.stringify(["yes", "no"]),
    );
    expect("branchRules" in config && config.branchRules.length).toBe(1);
    expect(
      "defaultNextBlockId" in config ? config.defaultNextBlockId : undefined,
    ).toBe("fallback");
  });

  test("falls back to default choice options when fewer than two valid options remain", () => {
    const config = normalizeBlockConfig("MULTIPLE_CHOICE", {
      options: ["", " only one "],
    });

    expect("options" in config && JSON.stringify(config.options)).toBe(
      JSON.stringify(["Option 1", "Option 2"]),
    );
  });
});
