import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import {
  analyzeBranchingGraph,
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
