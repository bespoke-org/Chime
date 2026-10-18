import { describe, expect, test } from "bun:test";

import { parseBlockConfig, type SerializedBlock } from "@/lib/blocks";
import {
  analyzeBranchingGraph,
  branchRuleMatches,
  resolveNextBlockId,
  resolveVisitedBlockIds,
} from "@/lib/branching";

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
              : overrides.type === "LINK"
                ? {
                    placeholder: "",
                    branchRules: [],
                    defaultNextBlockId: null,
                  }
                : overrides.type === "DATE"
                  ? {
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

function getIssueCodes(blocks: SerializedBlock[]) {
  const analysis = analyzeBranchingGraph(blocks);

  return {
    blockers: analysis.blockers.map((issue) => issue.code),
    warnings: analysis.warnings.map((issue) => issue.code),
  };
}

describe("branch-aware runner routing", () => {
  test("shows a conditional follow-up when the respondent answer matches a saved rule", () => {
    const blocks = [
      createBlock({
        id: "audience",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["student", "professional"],
          branchRules: [
            {
              operator: "equals",
              value: "student",
              targetBlockId: "student-follow-up",
            },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "generic-next", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "student-follow-up", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(
      resolveNextBlockId(blocks, "audience", { audience: "student" }),
    ).toBe("student-follow-up");
  });

  test("uses the first matching rule when more than one rule could match the same answer", () => {
    const blocks = [
      createBlock({
        id: "notes",
        type: "SHORT_TEXT",
        position: 0,
        config: {
          placeholder: "",
          validationRegex: null,
          branchRules: [
            {
              operator: "contains",
              value: "vip",
              targetBlockId: "priority-review",
            },
            {
              operator: "is_not_empty",
              value: null,
              targetBlockId: "standard-review",
            },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "standard-review", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "priority-review", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "notes", { notes: "vip customer" })).toBe(
      "priority-review",
    );
  });

  test("uses the configured default route when no branch rule matches", () => {
    const blocks = [
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "special" },
          ],
          defaultNextBlockId: "fallback",
        },
      }),
      createBlock({ id: "fallback", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "special", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "path", { path: "no" })).toBe("fallback");
  });

  test("ends immediately when a block is marked as terminal", () => {
    const blocks = [
      createBlock({
        id: "terminal-question",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "special" },
          ],
          defaultNextBlockId: "fallback",
          endForm: true,
        },
      }),
      createBlock({ id: "fallback", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "special", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(
      resolveNextBlockId(blocks, "terminal-question", {
        "terminal-question": "yes",
      }),
    ).toBe(null);
  });

  test("continues in saved order when no rule matches and no default route is configured", () => {
    const blocks = [
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "special" },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "saved-next", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "special", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "path", { path: "no" })).toBe(
      "saved-next",
    );
  });

  test("normalizes surrounding whitespace before exact text branching", () => {
    const blocks = [
      createBlock({
        id: "name",
        type: "SHORT_TEXT",
        position: 0,
        config: {
          placeholder: "",
          validationRegex: null,
          branchRules: [
            { operator: "equals", value: "Ada", targetBlockId: "named-path" },
          ],
          defaultNextBlockId: "default-path",
        },
      }),
      createBlock({ id: "default-path", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "named-path", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "name", { name: "  Ada  " })).toBe(
      "named-path",
    );
  });

  test("treats an empty multiple-choice answer as empty for branching", () => {
    const blocks = [
      createBlock({
        id: "topics",
        type: "MULTIPLE_CHOICE",
        position: 0,
        config: {
          options: ["billing", "support", "sales"],
          branchRules: [
            {
              operator: "is_empty",
              value: null,
              targetBlockId: "nothing-selected",
            },
          ],
          defaultNextBlockId: "selected-something",
        },
      }),
      createBlock({
        id: "selected-something",
        type: "SHORT_TEXT",
        position: 1,
      }),
      createBlock({ id: "nothing-selected", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "topics", { topics: [] })).toBe(
      "nothing-selected",
    );
  });

  test("does not take a multiple-choice branch when none of the selected answers match", () => {
    const blocks = [
      createBlock({
        id: "topics",
        type: "MULTIPLE_CHOICE",
        position: 0,
        config: {
          options: ["billing", "support", "sales"],
          branchRules: [
            {
              operator: "contains_any",
              value: "support",
              targetBlockId: "support-follow-up",
            },
          ],
          defaultNextBlockId: "general-follow-up",
        },
      }),
      createBlock({ id: "general-follow-up", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "support-follow-up", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(
      resolveNextBlockId(blocks, "topics", { topics: ["billing", "sales"] }),
    ).toBe("general-follow-up");
  });

  test("applies date boundary comparisons using the saved operator", () => {
    const blocks = [
      createBlock({
        id: "start-date",
        type: "DATE",
        position: 0,
        config: {
          branchRules: [
            {
              operator: "gte",
              value: "2026-01-01",
              targetBlockId: "current-program",
            },
          ],
          defaultNextBlockId: "legacy-program",
        },
      }),
      createBlock({ id: "legacy-program", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "current-program", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(
      resolveNextBlockId(blocks, "start-date", {
        "start-date": "2026-01-01",
      }),
    ).toBe("current-program");
  });

  test("fails safely to the default route when a date answer is invalid", () => {
    const blocks = [
      createBlock({
        id: "start-date",
        type: "DATE",
        position: 0,
        config: {
          branchRules: [
            {
              operator: "gte",
              value: "2026-01-01",
              targetBlockId: "current-program",
            },
          ],
          defaultNextBlockId: "legacy-program",
        },
      }),
      createBlock({ id: "legacy-program", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "current-program", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(
      resolveNextBlockId(blocks, "start-date", {
        "start-date": "2026-13-40",
      }),
    ).toBe("legacy-program");
  });

  test("branches on agreement answers using the saved exact value", () => {
    const blocks = [
      createBlock({
        id: "terms",
        type: "AGREEMENT",
        position: 0,
        config: {
          label: "I agree to the terms",
          branchRules: [
            { operator: "equals", value: "agreed", targetBlockId: "accepted" },
          ],
          defaultNextBlockId: "declined",
        },
      }),
      createBlock({ id: "declined", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "accepted", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "terms", { terms: "agreed" })).toBe(
      "accepted",
    );
    expect(resolveNextBlockId(blocks, "terms", { terms: "not_agreed" })).toBe(
      "declined",
    );
  });

  test("keeps text blocks in the visited route while branching only from question blocks", () => {
    const blocks = [
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({
        id: "audience",
        type: "SINGLE_CHOICE",
        position: 1,
        config: {
          options: ["student", "professional"],
          branchRules: [
            {
              operator: "equals",
              value: "student",
              targetBlockId: "student-follow-up",
            },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "generic-next", type: "SHORT_TEXT", position: 2 }),
      createBlock({ id: "student-follow-up", type: "SHORT_TEXT", position: 3 }),
    ];

    expect(
      JSON.stringify(resolveVisitedBlockIds(blocks, { audience: "student" })),
    ).toBe(JSON.stringify(["intro", "audience", "student-follow-up"]));
  });
});

describe("visited-route history", () => {
  test("recalculates future visited steps when an earlier branching answer changes", () => {
    const blocks = [
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["standard", "priority"],
          branchRules: [
            {
              operator: "equals",
              value: "priority",
              targetBlockId: "priority-review",
            },
          ],
          defaultNextBlockId: "standard-review",
        },
      }),
      createBlock({
        id: "standard-review",
        type: "SINGLE_CHOICE",
        position: 1,
        config: {
          options: ["continue", "continue"],
          branchRules: [],
          defaultNextBlockId: "finish",
        },
      }),
      createBlock({
        id: "priority-review",
        type: "SINGLE_CHOICE",
        position: 2,
        config: {
          options: ["continue", "continue"],
          branchRules: [],
          defaultNextBlockId: "finish",
        },
      }),
      createBlock({ id: "finish", type: "TEXT", position: 3 }),
    ];

    const originalRoute = resolveVisitedBlockIds(blocks, { path: "priority" });
    const recalculatedRoute = resolveVisitedBlockIds(blocks, {
      path: "standard",
    });

    expect(JSON.stringify(originalRoute)).toBe(
      JSON.stringify(["path", "priority-review", "finish"]),
    );
    expect(JSON.stringify(recalculatedRoute)).toBe(
      JSON.stringify(["path", "standard-review", "finish"]),
    );
  });
});

describe("publish-time graph validation", () => {
  test("blocks publishing when a branch rule points to a missing block", () => {
    const blocks = [
      createBlock({
        id: "question",
        type: "SHORT_TEXT",
        position: 0,
        config: {
          placeholder: "",
          validationRegex: null,
          branchRules: [
            {
              operator: "equals",
              value: "yes",
              targetBlockId: "missing-target",
            },
          ],
          defaultNextBlockId: null,
        },
      }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("invalid-target");
  });

  test("blocks publishing when a default route points to a missing block", () => {
    const blocks = [
      createBlock({
        id: "question",
        type: "SHORT_TEXT",
        position: 0,
        config: {
          placeholder: "",
          validationRegex: null,
          branchRules: [],
          defaultNextBlockId: "missing-default",
        },
      }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("invalid-default-target");
  });

  test("blocks publishing when a branch points backward to an earlier block", () => {
    const blocks = [
      createBlock({ id: "intro", type: "SHORT_TEXT", position: 0 }),
      createBlock({
        id: "later",
        type: "SHORT_TEXT",
        position: 1,
        config: {
          placeholder: "",
          validationRegex: null,
          branchRules: [
            { operator: "equals", value: "go", targetBlockId: "intro" },
          ],
          defaultNextBlockId: null,
        },
      }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("backward-target");
  });

  test("blocks publishing when a block uses an unsupported branch operator", () => {
    const blocks = [
      createBlock({
        id: "choice",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            {
              operator: "contains",
              value: "ye",
              targetBlockId: "follow-up",
            },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "follow-up", type: "SHORT_TEXT", position: 1 }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("unsupported-operator");
  });

  test("blocks publishing when a rule value is invalid for the question type", () => {
    const blocks = [
      createBlock({
        id: "age",
        type: "NUMBER",
        position: 0,
        config: {
          placeholder: "",
          allowFloat: false,
          min: null,
          max: null,
          branchRules: [
            { operator: "gte", value: "adult", targetBlockId: "allowed" },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "allowed", type: "SHORT_TEXT", position: 1 }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("invalid-condition");
  });

  test("blocks publishing when the same branch condition is configured twice", () => {
    const blocks = [
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "first-yes" },
            { operator: "equals", value: "yes", targetBlockId: "second-yes" },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "first-yes", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "second-yes", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("duplicate-condition");
  });

  test("blocks publishing when a block becomes unreachable from the form start", () => {
    const blocks = [
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 0,
        required: true,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "finish" },
            { operator: "equals", value: "no", targetBlockId: "finish" },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "skipped-forever", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "finish", type: "SHORT_TEXT", position: 2 }),
    ];

    const analysis = analyzeBranchingGraph(blocks);

    expect(
      analysis.blockers.some(
        (issue) =>
          issue.code === "unreachable-block" &&
          issue.blockId === "skipped-forever",
      ),
    ).toBe(true);
  });
});

function rule(
  operator: string,
  value: string | null,
  targetBlockId: string,
): { operator: never; value: string | null; targetBlockId: string } {
  return { operator: operator as never, value, targetBlockId };
}

function numberBlock(
  id: string,
  position: number,
  rules: ReturnType<typeof rule>[] = [],
  allowFloat = true,
) {
  return createBlock({
    id,
    type: "NUMBER",
    position,
    config: {
      placeholder: "",
      allowFloat,
      min: null,
      max: null,
      branchRules: rules,
      defaultNextBlockId: null,
    },
  });
}

function dateBlock(
  id: string,
  position: number,
  rules: ReturnType<typeof rule>[] = [],
) {
  return createBlock({
    id,
    type: "DATE",
    position,
    config: { branchRules: rules, defaultNextBlockId: null },
  });
}

function textBlock(
  id: string,
  position: number,
  rules: ReturnType<typeof rule>[] = [],
) {
  return createBlock({
    id,
    type: "SHORT_TEXT",
    position,
    config: {
      placeholder: "",
      validationRegex: null,
      branchRules: rules,
      defaultNextBlockId: null,
    },
  });
}

describe("branch rule targets at runtime", () => {
  test("skips rules that point to the block itself, an earlier block or a missing block", () => {
    const blocks = [
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 1,
        config: {
          options: ["yes", "no"],
          branchRules: [
            rule("equals", "yes", "gate"),
            rule("equals", "yes", "intro"),
            rule("equals", "yes", "ghost"),
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "after", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "gate", { gate: "yes" })).toBe("after");
  });

  test("falls back to the linear order when the default route points backward", () => {
    const blocks = [
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 1,
        config: {
          options: ["yes", "no"],
          branchRules: [],
          defaultNextBlockId: "intro",
        },
      }),
      createBlock({ id: "after", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(resolveNextBlockId(blocks, "gate", { gate: "no" })).toBe("after");
  });

  test("ends the form on a terminal block even when its rules match", () => {
    const blocks = [
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [rule("equals", "yes", "after")],
          defaultNextBlockId: "after",
          endForm: true,
        },
      }),
      createBlock({ id: "after", type: "SHORT_TEXT", position: 1 }),
    ];

    expect(resolveNextBlockId(blocks, "gate", { gate: "yes" })).toBe(null);
    expect(
      JSON.stringify(resolveVisitedBlockIds(blocks, { gate: "yes" })),
    ).toBe(JSON.stringify(["gate"]));
  });

  test("returns null for a block id that is not part of the form", () => {
    const blocks = [
      createBlock({ id: "only", type: "SHORT_TEXT", position: 0 }),
    ];

    expect(resolveNextBlockId(blocks, "ghost", {})).toBe(null);
  });
});

describe("number branch comparisons", () => {
  const block = numberBlock("amount", 0);

  test("treats the operand as an exclusive bound for gt and lt and inclusive for gte and lte", () => {
    expect(branchRuleMatches(block, "10", rule("gt", "10", "x"))).toBe(false);
    expect(branchRuleMatches(block, "10", rule("gte", "10", "x"))).toBe(true);
    expect(branchRuleMatches(block, "10", rule("lt", "10", "x"))).toBe(false);
    expect(branchRuleMatches(block, "10", rule("lte", "10", "x"))).toBe(true);
    expect(branchRuleMatches(block, "10.0001", rule("gt", "10", "x"))).toBe(
      true,
    );
  });

  test("compares numerically, not as strings", () => {
    expect(branchRuleMatches(block, "9", rule("lt", "10", "x"))).toBe(true);
    expect(branchRuleMatches(block, "100", rule("gt", "20", "x"))).toBe(true);
    expect(branchRuleMatches(block, "1.0", rule("equals", "1", "x"))).toBe(
      true,
    );
    expect(branchRuleMatches(block, "007", rule("equals", "7", "x"))).toBe(
      true,
    );
  });

  test("accepts a comma decimal on either side", () => {
    expect(branchRuleMatches(block, "12,5", rule("equals", "12.5", "x"))).toBe(
      true,
    );
    expect(branchRuleMatches(block, "12.5", rule("gte", "12,5", "x"))).toBe(
      true,
    );
  });

  test("handles negative numbers", () => {
    expect(branchRuleMatches(block, "-5", rule("lt", "0", "x"))).toBe(true);
    expect(branchRuleMatches(block, "-5", rule("gt", "-10", "x"))).toBe(true);
    expect(branchRuleMatches(block, "-0", rule("equals", "0", "x"))).toBe(true);
  });

  test("never matches when the operand is not a plain decimal", () => {
    for (const operand of ["1e3", "0x10", "Infinity", "abc", ""]) {
      expect(branchRuleMatches(block, "1000", rule("gte", operand, "x"))).toBe(
        false,
      );
      expect(
        branchRuleMatches(block, "1000", rule("equals", operand, "x")),
      ).toBe(false);
    }
  });

  test("never matches a comparison when the answer is not numeric", () => {
    expect(branchRuleMatches(block, "ten", rule("gt", "5", "x"))).toBe(false);
    expect(
      branchRuleMatches(block, "ten", rule("is_not_empty", null, "x")),
    ).toBe(false);
    expect(branchRuleMatches(block, "ten", rule("is_empty", null, "x"))).toBe(
      true,
    );
  });
});

describe("date branch comparisons", () => {
  const block = dateBlock("when", 0);

  test("compares dates at the day boundary", () => {
    expect(
      branchRuleMatches(block, "2024-03-01", rule("gt", "2024-02-29", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "2024-02-29", rule("gt", "2024-02-29", "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, "2024-02-29", rule("gte", "2024-02-29", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "2024-02-29", rule("lte", "2024-02-29", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "2024-02-28", rule("lt", "2024-02-29", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "2024-02-29", rule("equals", "2024-02-29", "x")),
    ).toBe(true);
  });

  test("orders across year and month boundaries", () => {
    expect(
      branchRuleMatches(block, "2025-01-01", rule("gt", "2024-12-31", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "2024-10-01", rule("gt", "2024-09-30", "x")),
    ).toBe(true);
  });

  test("never matches when the operand is not a calendar date", () => {
    for (const operand of ["2023-02-29", "2024-2-5", "05.02.2024", ""]) {
      expect(
        branchRuleMatches(block, "2024-03-01", rule("gt", operand, "x")),
      ).toBe(false);
    }
  });

  test("treats an invalid answer as empty", () => {
    expect(
      branchRuleMatches(block, "2024-02-30", rule("is_empty", null, "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "2024-02-30", rule("lte", "2024-12-31", "x")),
    ).toBe(false);
  });
});

describe("multiple choice branch comparisons", () => {
  const block = createBlock({
    id: "colors",
    type: "MULTIPLE_CHOICE",
    position: 0,
  });

  test("contains_any matches when the operand is among the selections, in any order", () => {
    expect(
      branchRuleMatches(
        block,
        ["blue", "red"],
        rule("contains_any", "red", "x"),
      ),
    ).toBe(true);
    expect(
      branchRuleMatches(
        block,
        ["red", "blue", "green"],
        rule("contains_any", "green", "x"),
      ),
    ).toBe(true);
    expect(
      branchRuleMatches(block, ["blue"], rule("contains_any", "red", "x")),
    ).toBe(false);
  });

  test("equals behaves as membership rather than exact set equality", () => {
    expect(
      branchRuleMatches(block, ["red", "blue"], rule("equals", "red", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, ["red", "blue"], rule("not_equals", "red", "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, ["blue"], rule("not_equals", "red", "x")),
    ).toBe(true);
  });

  test("ignores selections that are not options and treats the rest as the answer", () => {
    expect(
      branchRuleMatches(block, ["purple"], rule("is_empty", null, "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(
        block,
        ["purple", " red "],
        rule("contains_any", "red", "x"),
      ),
    ).toBe(true);
  });

  test("an empty array is empty and matches nothing else", () => {
    expect(branchRuleMatches(block, [], rule("is_empty", null, "x"))).toBe(
      true,
    );
    expect(branchRuleMatches(block, [], rule("is_not_empty", null, "x"))).toBe(
      false,
    );
    expect(branchRuleMatches(block, [], rule("contains_any", "red", "x"))).toBe(
      false,
    );
    expect(branchRuleMatches(block, [], rule("not_equals", "red", "x"))).toBe(
      false,
    );
  });

  test("never matches an operand that is not one of the options", () => {
    expect(
      branchRuleMatches(block, ["red"], rule("contains_any", "purple", "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, ["red"], rule("contains_any", "Red", "x")),
    ).toBe(false);
  });

  test("a plain string answer is treated as empty", () => {
    expect(
      branchRuleMatches(block, "red", rule("contains_any", "red", "x")),
    ).toBe(false);
    expect(branchRuleMatches(block, "red", rule("is_empty", null, "x"))).toBe(
      true,
    );
  });
});

describe("text branch comparisons", () => {
  const block = textBlock("notes", 0);

  test("contains and equals are case-sensitive", () => {
    expect(
      branchRuleMatches(block, "Hello world", rule("contains", "hello", "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, "Hello world", rule("contains", "Hello", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "Hello", rule("equals", "hello", "x")),
    ).toBe(false);
  });

  test("trims both the answer and the operand before comparing", () => {
    expect(
      branchRuleMatches(block, "  hello  ", rule("equals", " hello ", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(
        block,
        "  hello world  ",
        rule("contains", " lo wo ", "x"),
      ),
    ).toBe(true);
  });

  test("handles Cyrillic and emoji", () => {
    expect(
      branchRuleMatches(block, "Привет, мир", rule("contains", "мир", "x")),
    ).toBe(true);
    expect(
      branchRuleMatches(block, "Привет, мир", rule("contains", "Мир", "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, "I ❤️ forms", rule("contains", "❤️", "x")),
    ).toBe(true);
    expect(branchRuleMatches(block, "Ёлка", rule("equals", "Ёлка", "x"))).toBe(
      true,
    );
  });

  test("an empty or whitespace operand never matches a value operator", () => {
    expect(
      branchRuleMatches(block, "anything", rule("contains", "", "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, "anything", rule("contains", "   ", "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, "anything", rule("equals", null, "x")),
    ).toBe(false);
  });

  test("a whitespace-only answer counts as empty", () => {
    expect(branchRuleMatches(block, " \n ", rule("is_empty", null, "x"))).toBe(
      true,
    );
    expect(
      branchRuleMatches(block, " \n ", rule("is_not_empty", null, "x")),
    ).toBe(false);
    expect(
      branchRuleMatches(block, undefined, rule("is_empty", null, "x")),
    ).toBe(true);
  });
});

describe("degenerate forms", () => {
  test("walks a chain of text-only blocks in saved order", () => {
    const blocks = [
      createBlock({ id: "a", type: "TEXT", position: 0 }),
      createBlock({ id: "b", type: "TEXT", position: 1 }),
      createBlock({ id: "c", type: "TEXT", position: 2 }),
    ];

    expect(JSON.stringify(resolveVisitedBlockIds(blocks, {}))).toBe(
      JSON.stringify(["a", "b", "c"]),
    );
    expect(analyzeBranchingGraph(blocks).blockers.length).toBe(0);
  });

  test("handles a single block and an empty form", () => {
    const single = [
      createBlock({ id: "only", type: "SHORT_TEXT", position: 0 }),
    ];

    expect(JSON.stringify(resolveVisitedBlockIds(single, {}))).toBe(
      JSON.stringify(["only"]),
    );
    expect(JSON.stringify(resolveVisitedBlockIds([], {}))).toBe("[]");
    expect(analyzeBranchingGraph([]).blockers.length).toBe(0);
  });

  test("a terminal first block makes every later block unreachable", () => {
    const blocks = [
      createBlock({
        id: "intro",
        type: "TEXT",
        position: 0,
        config: { body: "Bye", endForm: true },
      }),
      createBlock({ id: "never", type: "SHORT_TEXT", position: 1 }),
    ];

    expect(JSON.stringify(resolveVisitedBlockIds(blocks, {}))).toBe(
      JSON.stringify(["intro"]),
    );
    expect(
      analyzeBranchingGraph(blocks).blockers.some(
        (issue) =>
          issue.code === "unreachable-block" && issue.blockId === "never",
      ),
    ).toBe(true);
  });
});

describe("branch validation edge cases", () => {
  test("treats operands that differ only by surrounding whitespace as duplicates", () => {
    const blocks = [
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            rule("equals", "yes", "a"),
            rule("equals", "  yes ", "b"),
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "a", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "b", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("duplicate-condition");
  });

  test("text operands that differ by case are distinct conditions", () => {
    const blocks = [
      textBlock("notes", 0, [
        rule("contains", "Yes", "a"),
        rule("contains", "yes", "b"),
      ]),
      createBlock({ id: "a", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "b", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(getIssueCodes(blocks).blockers).not.toContain("duplicate-condition");
  });

  test("a choice operand that is not an option is an invalid condition, not a duplicate", () => {
    const blocks = [
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [rule("equals", "yes", "a"), rule("equals", "Yes", "b")],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "a", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "b", type: "SHORT_TEXT", position: 2 }),
    ];

    const codes = getIssueCodes(blocks).blockers;

    expect(codes).toContain("invalid-condition");
    expect(codes).not.toContain("duplicate-condition");
  });

  test("more than 50 rules are rejected by the config schema", () => {
    const branchRules = Array.from({ length: 51 }, (_, index) =>
      rule("contains", `v${index}`, "a"),
    );

    let threw = false;
    try {
      parseBlockConfig("SHORT_TEXT", { branchRules, placeholder: "" });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    const accepted = parseBlockConfig("SHORT_TEXT", {
      branchRules: branchRules.slice(0, 50),
      placeholder: "",
    });
    expect("branchRules" in accepted && accepted.branchRules.length).toBe(50);
  });

  test("a rule and the default route may point to the same block", () => {
    const blocks = [
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [rule("equals", "yes", "finish")],
          defaultNextBlockId: "finish",
        },
      }),
      createBlock({ id: "finish", type: "SHORT_TEXT", position: 1 }),
    ];

    expect(getIssueCodes(blocks).blockers.length).toBe(0);
  });

  test("a block reachable only from an unreachable block is itself unreachable", () => {
    const blocks = [
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [],
          defaultNextBlockId: "finish",
        },
      }),
      createBlock({
        id: "orphan",
        type: "SINGLE_CHOICE",
        position: 1,
        config: {
          options: ["yes", "no"],
          branchRules: [rule("equals", "yes", "orphan-child")],
          defaultNextBlockId: "finish",
        },
      }),
      createBlock({ id: "orphan-child", type: "SHORT_TEXT", position: 2 }),
      createBlock({ id: "finish", type: "SHORT_TEXT", position: 3 }),
    ];

    const unreachable = analyzeBranchingGraph(blocks)
      .blockers.filter((issue) => issue.code === "unreachable-block")
      .map((issue) => issue.blockId)
      .sort();

    expect(JSON.stringify(unreachable)).toBe(
      JSON.stringify(["orphan", "orphan-child"]),
    );
  });

  test("branch rules on a text block are flagged at validation and ignored at runtime", () => {
    const blocks = [
      createBlock({
        id: "intro",
        type: "TEXT",
        position: 0,
        config: {
          body: "Intro",
          branchRules: [rule("is_not_empty", null, "far")],
        } as never,
      }),
      createBlock({ id: "near", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "far", type: "SHORT_TEXT", position: 2 }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("unsupported-operator");
    expect(resolveNextBlockId(blocks, "intro", {})).toBe("near");
  });

  test("a number operand that is not a plain decimal is an invalid condition", () => {
    const blocks = [
      numberBlock("amount", 0, [rule("gt", "1e3", "finish")]),
      createBlock({ id: "finish", type: "SHORT_TEXT", position: 1 }),
    ];

    expect(getIssueCodes(blocks).blockers).toContain("invalid-condition");
  });
});

function ratingBlock(
  id: string,
  position: number,
  rules: ReturnType<typeof rule>[] = [],
  scale: { min: 0 | 1; max: number } = { min: 1, max: 5 },
) {
  return createBlock({
    id,
    type: "RATING",
    position,
    config: {
      ...scale,
      minLabel: "",
      maxLabel: "",
      branchRules: rules,
      defaultNextBlockId: null,
    },
  });
}

describe("rating branch rules", () => {
  test("compares ratings numerically at the scale boundaries", () => {
    const block = ratingBlock("score", 0);

    expect(branchRuleMatches(block, "5", rule("gte", "5", "t"))).toBe(true);
    expect(branchRuleMatches(block, "4", rule("gte", "5", "t"))).toBe(false);
    expect(branchRuleMatches(block, "1", rule("lte", "1", "t"))).toBe(true);
    expect(branchRuleMatches(block, "1", rule("lt", "1", "t"))).toBe(false);
    expect(branchRuleMatches(block, "10", rule("gt", "9", "t"))).toBe(true);
    expect(branchRuleMatches(block, "10", rule("gt", "9.5", "t"))).toBe(true);
  });

  test("matches equals on the normalized value", () => {
    const block = ratingBlock("score", 0);

    expect(branchRuleMatches(block, "3", rule("equals", "3", "t"))).toBe(true);
    expect(branchRuleMatches(block, "3", rule("equals", "03", "t"))).toBe(true);
    expect(branchRuleMatches(block, "3", rule("equals", "3,0", "t"))).toBe(
      true,
    );
    expect(branchRuleMatches(block, "3", rule("not_equals", "3", "t"))).toBe(
      false,
    );
  });

  test("treats a missing or blank rating as empty", () => {
    const block = ratingBlock("score", 0);

    expect(
      branchRuleMatches(block, undefined, rule("is_empty", null, "t")),
    ).toBe(true);
    expect(branchRuleMatches(block, "   ", rule("is_empty", null, "t"))).toBe(
      true,
    );
    expect(branchRuleMatches(block, "0", rule("is_empty", null, "t"))).toBe(
      false,
    );
    expect(branchRuleMatches(block, "0", rule("is_not_empty", null, "t"))).toBe(
      true,
    );
    expect(branchRuleMatches(block, undefined, rule("gte", "1", "t"))).toBe(
      false,
    );
  });

  test("routes an NPS answer to the matching follow-up", () => {
    const blocks = [
      ratingBlock(
        "nps",
        0,
        [
          rule("lte", "6", "detractor"),
          rule("lte", "8", "passive"),
          rule("gte", "9", "promoter"),
        ],
        { min: 0, max: 10 },
      ),
      createBlock({ id: "detractor", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "passive", type: "SHORT_TEXT", position: 2 }),
      createBlock({ id: "promoter", type: "SHORT_TEXT", position: 3 }),
    ];

    expect(resolveNextBlockId(blocks, "nps", { nps: "0" })).toBe("detractor");
    expect(resolveNextBlockId(blocks, "nps", { nps: "6" })).toBe("detractor");
    expect(resolveNextBlockId(blocks, "nps", { nps: "7" })).toBe("passive");
    expect(resolveNextBlockId(blocks, "nps", { nps: "9" })).toBe("promoter");
    expect(resolveNextBlockId(blocks, "nps", { nps: "10" })).toBe("promoter");
    expect(resolveNextBlockId(blocks, "nps", {})).toBe("detractor");
  });

  test("flags a non-numeric rating operand and a text operator", () => {
    expect(
      getIssueCodes([
        ratingBlock("score", 0, [rule("gte", "high", "finish")]),
        createBlock({ id: "finish", type: "SHORT_TEXT", position: 1 }),
      ]).blockers,
    ).toContain("invalid-condition");
    expect(
      getIssueCodes([
        ratingBlock("score", 0, [rule("contains", "4", "finish")]),
        createBlock({ id: "finish", type: "SHORT_TEXT", position: 1 }),
      ]).blockers,
    ).toContain("unsupported-operator");
  });
});
