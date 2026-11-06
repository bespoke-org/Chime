import { describe, expect, test } from "bun:test";

import { getDefaultBlockConfig, type SerializedBlock } from "@/lib/blocks";
import { resolvePages } from "@/lib/pages";
import {
  effectiveRepeatSettings,
  instanceAnswerEntries,
  isNestedRepeatingAnswer,
  MAX_PAGE_INSTANCES,
  projectInstanceAnswers,
  resolveInstanceCount,
  validateAndNormalizeRepeatingAnswer,
  validateRepeatSettings,
} from "@/lib/repeat";

type TestBlock = SerializedBlock & { pageId?: string | null };

function createBlock(
  overrides: Partial<TestBlock> & Pick<TestBlock, "id" | "type" | "position">,
): TestBlock {
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
  } as TestBlock;
}

function choiceBlock(
  overrides: Partial<TestBlock> & Pick<TestBlock, "id" | "position">,
): TestBlock {
  return createBlock({
    type: "MULTIPLE_CHOICE",
    config: {
      ...getDefaultBlockConfig("MULTIPLE_CHOICE"),
      options: ["Tea", "Coffee"],
    },
    ...overrides,
  });
}

// count(page 1) -> team(page 2, repeating by count) -> note(page 3)
function createPages() {
  return resolvePages(
    [
      createBlock({
        id: "count",
        type: "NUMBER",
        position: 0,
        pageId: "count-page",
      }),
      createBlock({
        id: "name",
        type: "SHORT_TEXT",
        position: 1,
        pageId: "team-page",
      }),
      choiceBlock({ id: "drinks", position: 2, pageId: "team-page" }),
      createBlock({
        id: "note",
        type: "LONG_TEXT",
        position: 3,
        pageId: "note-page",
      }),
    ],
    [
      { id: "count-page" },
      { id: "team-page", repeat: { countBlockId: "count" } },
      { id: "note-page" },
    ],
  );
}

describe("resolveInstanceCount", () => {
  test("resolves a whole number", () => {
    expect(resolveInstanceCount("3")).toEqual({ status: "count", count: 3 });
    expect(resolveInstanceCount("0")).toEqual({ status: "count", count: 0 });
    expect(resolveInstanceCount(" 5 ")).toEqual({ status: "count", count: 5 });
  });

  test("reports a missing count", () => {
    expect(resolveInstanceCount(undefined)).toEqual({ status: "missing" });
    expect(resolveInstanceCount("")).toEqual({ status: "missing" });
    expect(resolveInstanceCount("  ")).toEqual({ status: "missing" });
    expect(resolveInstanceCount(["3"])).toEqual({ status: "missing" });
  });

  test("rejects values that are not whole non-negative numbers", () => {
    expect(resolveInstanceCount("2.5")).toEqual({ status: "invalid" });
    expect(resolveInstanceCount("-1")).toEqual({ status: "invalid" });
    expect(resolveInstanceCount("many")).toEqual({ status: "invalid" });
  });

  test("rejects a count above the cap", () => {
    expect(resolveInstanceCount(String(MAX_PAGE_INSTANCES + 1))).toEqual({
      status: "too_large",
      max: MAX_PAGE_INSTANCES,
    });
    expect(resolveInstanceCount(String(MAX_PAGE_INSTANCES))).toEqual({
      status: "count",
      count: MAX_PAGE_INSTANCES,
    });
  });
});

describe("effectiveRepeatSettings", () => {
  test("returns the settings for a resolvable repeat", () => {
    const pages = createPages();
    const team = pages.find((page) => page.id === "team-page");

    expect(effectiveRepeatSettings(team as never, pages)).toEqual({
      countBlockId: "count",
    });
  });

  test("returns null for pages without repeat settings", () => {
    const pages = createPages();
    const note = pages.find((page) => page.id === "note-page");

    expect(effectiveRepeatSettings(note as never, pages)).toBe(null);
  });

  test("degrades when the count block is missing", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "team-page",
        }),
      ],
      [{ id: "team-page", repeat: { countBlockId: "gone" } }],
    );

    expect(effectiveRepeatSettings(pages[0], pages)).toBe(null);
  });

  test("degrades when the count block is not a number block", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "count",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "count-page",
        }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "team-page",
        }),
      ],
      [
        { id: "count-page" },
        { id: "team-page", repeat: { countBlockId: "count" } },
      ],
    );

    expect(effectiveRepeatSettings(pages[1], pages)).toBe(null);
  });

  test("degrades when the count block is on or after the repeating page", () => {
    const same = resolvePages(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "team-page",
        }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "team-page",
        }),
      ],
      [{ id: "team-page", repeat: { countBlockId: "count" } }],
    );
    expect(effectiveRepeatSettings(same[0], same)).toBe(null);

    const later = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "team-page",
        }),
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 1,
          pageId: "count-page",
        }),
      ],
      [
        { id: "team-page", repeat: { countBlockId: "count" } },
        { id: "count-page" },
      ],
    );
    expect(effectiveRepeatSettings(later[0], later)).toBe(null);
  });

  test("degrades when the count block sits on a repeating page", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "outer-count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
        }),
        createBlock({
          id: "inner-count",
          type: "NUMBER",
          position: 1,
          pageId: "inner-page",
        }),
        createBlock({
          id: "inner-name",
          type: "SHORT_TEXT",
          position: 2,
          pageId: "inner-page",
        }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 3,
          pageId: "team-page",
        }),
      ],
      [
        { id: "count-page" },
        { id: "inner-page", repeat: { countBlockId: "outer-count" } },
        { id: "team-page", repeat: { countBlockId: "inner-count" } },
      ],
    );

    expect(effectiveRepeatSettings(pages[2], pages)).toBe(null);
  });
});

describe("validateRepeatSettings", () => {
  test("reports nothing for resolvable settings", () => {
    expect(validateRepeatSettings(createPages())).toEqual([]);
  });

  test("reports a deleted count block", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "team-page",
        }),
      ],
      [{ id: "team-page", repeat: { countBlockId: "gone" } }],
    );

    expect(validateRepeatSettings(pages)).toEqual([
      {
        code: "repeat_count_block_missing",
        pageId: "team-page",
        countBlockId: "gone",
      },
    ]);
  });

  test("reports a count block on the repeating page", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "team-page",
        }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "team-page",
        }),
      ],
      [{ id: "team-page", repeat: { countBlockId: "count" } }],
    );

    expect(validateRepeatSettings(pages)[0]?.code).toBe(
      "repeat_count_block_on_page",
    );
  });

  test("reports a count block after the repeating page", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "team-page",
        }),
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 1,
          pageId: "count-page",
        }),
      ],
      [
        { id: "team-page", repeat: { countBlockId: "count" } },
        { id: "count-page" },
      ],
    );

    expect(validateRepeatSettings(pages)[0]?.code).toBe(
      "repeat_count_block_after_page",
    );
  });

  test("reports a count block of the wrong type", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "count",
          type: "SHORT_TEXT",
          position: 0,
          pageId: "count-page",
        }),
        createBlock({
          id: "name",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "team-page",
        }),
      ],
      [
        { id: "count-page" },
        { id: "team-page", repeat: { countBlockId: "count" } },
      ],
    );

    expect(validateRepeatSettings(pages)[0]?.code).toBe(
      "repeat_count_block_not_number",
    );
  });
});

describe("validateAndNormalizeRepeatingAnswer", () => {
  test("validates and keeps every instance of a scalar block", () => {
    const block = createBlock({ id: "name", type: "SHORT_TEXT", position: 0 });

    expect(
      validateAndNormalizeRepeatingAnswer(block, ["Ann", " Bob "], 2),
    ).toEqual({ ok: true, values: ["Ann", "Bob"] });
  });

  test("keeps the nested shape of a multiple choice block", () => {
    const block = choiceBlock({ id: "drinks", position: 0 });

    expect(
      validateAndNormalizeRepeatingAnswer(
        block,
        [["Tea", "Coffee"], ["Tea"]],
        2,
      ),
    ).toEqual({ ok: true, values: [["Tea", "Coffee"], ["Tea"]] });
  });

  test("reports the instance that failed", () => {
    const block = createBlock({
      id: "name",
      type: "SHORT_TEXT",
      position: 0,
      required: true,
    });

    const result = validateAndNormalizeRepeatingAnswer(block, ["Ann", ""], 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.instanceIndex).toBe(1);
      expect(result.error.code).toBe("answer_required");
    }
  });

  test("trims trailing unanswered instances", () => {
    const block = createBlock({ id: "name", type: "SHORT_TEXT", position: 0 });

    expect(validateAndNormalizeRepeatingAnswer(block, ["Ann"], 3)).toEqual({
      ok: true,
      values: ["Ann"],
    });
    expect(validateAndNormalizeRepeatingAnswer(block, undefined, 3)).toEqual({
      ok: true,
      values: [],
    });
  });

  test("ignores instances beyond the current count", () => {
    const block = createBlock({ id: "name", type: "SHORT_TEXT", position: 0 });

    expect(
      validateAndNormalizeRepeatingAnswer(block, ["Ann", "Bob", "Cid"], 2),
    ).toEqual({ ok: true, values: ["Ann", "Bob"] });
  });
});

describe("isNestedRepeatingAnswer", () => {
  test("tells nested from flat by the block type", () => {
    const scalar = createBlock({ id: "name", type: "SHORT_TEXT", position: 0 });
    const choice = choiceBlock({ id: "drinks", position: 0 });

    expect(isNestedRepeatingAnswer(scalar, ["Ann"])).toBe(true);
    expect(isNestedRepeatingAnswer(scalar, "Ann")).toBe(false);
    expect(isNestedRepeatingAnswer(choice, [["Tea"], ["Coffee"]])).toBe(true);
    expect(isNestedRepeatingAnswer(choice, ["Tea", "Coffee"])).toBe(false);
    expect(isNestedRepeatingAnswer(scalar, null)).toBe(false);
  });
});

describe("projectInstanceAnswers", () => {
  test("collapses repeating blocks to one instance and keeps flat values", () => {
    const pages = createPages();

    const projected = projectInstanceAnswers(
      {
        count: "2",
        name: ["Ann", "Bob"],
        drinks: [["Tea"], ["Tea", "Coffee"]],
        note: "thanks",
      },
      pages,
      1,
    );

    expect(projected).toEqual({
      count: "2",
      name: "Bob",
      drinks: ["Tea", "Coffee"],
      note: "thanks",
    });
  });

  test("drops a block whose instance was not answered", () => {
    const pages = createPages();

    const projected = projectInstanceAnswers(
      { name: ["Ann"], drinks: [["Tea"]] },
      pages,
      1,
    );

    expect(projected).toEqual({});
  });

  test("passes flat answers through when settings degraded", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
        }),
        choiceBlock({ id: "drinks", position: 1, pageId: "team-page" }),
      ],
      [
        { id: "count-page" },
        { id: "team-page", repeat: { countBlockId: "count" } },
      ],
    );

    const projected = projectInstanceAnswers(
      { drinks: ["Tea", "Coffee"] },
      pages,
      0,
    );

    expect(projected).toEqual({ drinks: ["Tea", "Coffee"] });
  });
});

describe("instanceAnswerEntries", () => {
  test("returns the answered instances with their instance numbers", () => {
    expect(instanceAnswerEntries(["Ann", null, "Cid"])).toEqual([
      { value: "Ann", instanceIndex: 0 },
      { value: "Cid", instanceIndex: 2 },
    ]);
    expect(instanceAnswerEntries([["Tea"], [], ["Coffee"]])).toEqual([
      { value: ["Tea"], instanceIndex: 0 },
      { value: ["Coffee"], instanceIndex: 2 },
    ]);
  });

  test("returns nothing for non-array values", () => {
    expect(instanceAnswerEntries("Ann")).toEqual([]);
    expect(instanceAnswerEntries(undefined)).toEqual([]);
  });
});
