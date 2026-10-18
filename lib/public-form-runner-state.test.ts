import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import { resolveNextBlockId, resolveVisitedBlockIds } from "@/lib/branching";
import {
  advanceRunnerRoute,
  createInitialRunnerRoute,
  getCurrentRouteBlockId,
  getRouteCursor,
  getVisibleRouteTotal,
  hasRunnerProgress,
  retreatRunnerRoute,
} from "@/lib/public-form-runner-state";

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

describe("public form runner state helpers", () => {
  test("starts the route at the first saved block", () => {
    const blocks = [
      createBlock({ id: "intro", type: "TEXT", position: 0 }),
      createBlock({ id: "question", type: "SHORT_TEXT", position: 1 }),
    ];

    const route = createInitialRunnerRoute(blocks);

    expect(JSON.stringify(route.history)).toBe(JSON.stringify(["intro"]));
    expect(getCurrentRouteBlockId(route, blocks)).toBe("intro");
  });

  test("replaces future history when the respondent continues from an earlier step", () => {
    const originalRoute = {
      history: ["intro", "standard", "finish"],
      cursor: 1,
    };

    const nextRoute = advanceRunnerRoute(originalRoute, "standard", "priority");

    expect(JSON.stringify(nextRoute.history)).toBe(
      JSON.stringify(["intro", "standard", "priority"]),
    );
    expect(nextRoute.cursor).toBe(2);
  });

  test("progress total follows the actual remaining branch route instead of the full saved block list", () => {
    const blocks = [
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "finish" },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "skipped", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "finish", type: "SHORT_TEXT", position: 2 }),
    ];

    const total = getVisibleRouteTotal({
      blocks,
      currentBlockId: "path",
      answers: { path: "yes" },
      cursor: 0,
    });

    expect(total).toBe(2);
  });

  test("branches correctly during forward-only progression", () => {
    const blocks = [
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [
            { operator: "equals", value: "yes", targetBlockId: "finish" },
          ],
          defaultNextBlockId: "fallback",
        },
      }),
      createBlock({ id: "fallback", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "finish", type: "SHORT_TEXT", position: 2 }),
    ];
    const nextBlockId = resolveNextBlockId(blocks, "path", { path: "yes" });
    const nextRoute = advanceRunnerRoute(
      createInitialRunnerRoute(blocks),
      "path",
      nextBlockId ?? "fallback",
    );

    expect(nextBlockId).toBe("finish");
    expect(JSON.stringify(nextRoute.history)).toBe(
      JSON.stringify(["path", "finish"]),
    );
    expect(nextRoute.cursor).toBe(1);
  });

  test("detects saved progress from answers, cursor movement, or history growth", () => {
    expect(
      hasRunnerProgress({
        answers: {},
        cursor: 0,
        historyLength: 1,
        initialHistoryLength: 1,
      }),
    ).toBe(false);

    expect(
      hasRunnerProgress({
        answers: { question: "Ada" },
        cursor: 0,
        historyLength: 1,
        initialHistoryLength: 1,
      }),
    ).toBe(true);

    expect(
      hasRunnerProgress({
        answers: {},
        cursor: 1,
        historyLength: 2,
        initialHistoryLength: 1,
      }),
    ).toBe(true);
  });

  test("moves backward without changing visited history", () => {
    const route = retreatRunnerRoute({
      history: ["intro", "question", "finish"],
      cursor: 2,
    });

    expect(route.cursor).toBe(1);
    expect(JSON.stringify(route.history)).toBe(
      JSON.stringify(["intro", "question", "finish"]),
    );
  });

  test("does not move backward when back navigation is disabled", () => {
    const route = retreatRunnerRoute(
      {
        history: ["intro", "question", "finish"],
        cursor: 2,
      },
      { allowBackNavigation: false },
    );

    expect(route.cursor).toBe(2);
    expect(JSON.stringify(route.history)).toBe(
      JSON.stringify(["intro", "question", "finish"]),
    );
  });
});

describe("public form runner state edge cases", () => {
  const branchingBlocks = [
    createBlock({
      id: "path",
      type: "SINGLE_CHOICE",
      position: 0,
      config: {
        options: ["yes", "no"],
        branchRules: [
          { operator: "equals", value: "yes", targetBlockId: "finish" },
        ],
        defaultNextBlockId: "fallback",
      },
    }),
    createBlock({ id: "fallback", type: "SHORT_TEXT", position: 1 }),
    createBlock({ id: "extra", type: "SHORT_TEXT", position: 2 }),
    createBlock({ id: "finish", type: "SHORT_TEXT", position: 3 }),
  ];

  test("changing an earlier answer onto another branch truncates history and shrinks the total", () => {
    const answers = { path: "no", fallback: "a", extra: "b" };
    let route = createInitialRunnerRoute(branchingBlocks);
    route = advanceRunnerRoute(route, "path", "fallback");
    route = advanceRunnerRoute(route, "fallback", "extra");
    route = advanceRunnerRoute(route, "extra", "finish");
    route = { ...route, cursor: 0 };

    expect(
      getVisibleRouteTotal({
        blocks: branchingBlocks,
        currentBlockId: "path",
        answers,
        cursor: 0,
      }),
    ).toBe(4);

    const switched = { ...answers, path: "yes" };
    const next = resolveNextBlockId(branchingBlocks, "path", switched);
    route = advanceRunnerRoute(route, "path", next ?? "fallback");

    expect(JSON.stringify(route.history)).toBe(
      JSON.stringify(["path", "finish"]),
    );
    expect(route.cursor).toBe(1);
    expect(
      getVisibleRouteTotal({
        blocks: branchingBlocks,
        currentBlockId: "path",
        answers: switched,
        cursor: 0,
      }),
    ).toBe(2);
  });

  test("route helpers leave answers from an abandoned branch untouched", () => {
    const answers = { path: "yes", fallback: "a", extra: "b" };
    const visited = resolveVisitedBlockIds(branchingBlocks, answers);

    expect(JSON.stringify(visited)).toBe(JSON.stringify(["path", "finish"]));
    expect(Object.keys(answers).sort().join(",")).toBe("extra,fallback,path");
  });

  test("ignores an advance whose source is not the active block", () => {
    const route = { history: ["path", "fallback"], cursor: 1 };

    expect(advanceRunnerRoute(route, "path", "extra")).toBe(route);
  });

  test("a terminal block has no next step and the total stops there", () => {
    const blocks = [
      createBlock({
        id: "gate",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [],
          defaultNextBlockId: null,
          endForm: true,
        },
      }),
      createBlock({ id: "after", type: "SHORT_TEXT", position: 1 }),
    ];

    expect(resolveNextBlockId(blocks, "gate", { gate: "yes" })).toBe(null);
    expect(
      getVisibleRouteTotal({
        blocks,
        currentBlockId: "gate",
        answers: { gate: "yes" },
        cursor: 0,
      }),
    ).toBe(1);
  });

  test("back navigation stops at the first step", () => {
    const route = retreatRunnerRoute({ history: ["a", "b"], cursor: 0 });

    expect(route.cursor).toBe(0);
  });

  test("clamps a cursor that runs past the history", () => {
    const blocks = [
      createBlock({ id: "a", type: "SHORT_TEXT", position: 0 }),
      createBlock({ id: "b", type: "SHORT_TEXT", position: 1 }),
    ];
    const route = { history: ["a", "b"], cursor: 7 };

    expect(getRouteCursor(route)).toBe(1);
    expect(getCurrentRouteBlockId(route, blocks)).toBe("b");
    expect(getCurrentRouteBlockId({ history: [], cursor: 3 }, blocks)).toBe(
      "a",
    );
    expect(getCurrentRouteBlockId({ history: [], cursor: 0 }, [])).toBe(null);
  });

  test("a current block that no longer exists yields a total of the steps taken so far", () => {
    const blocks = [createBlock({ id: "a", type: "SHORT_TEXT", position: 0 })];

    expect(
      getVisibleRouteTotal({
        blocks,
        currentBlockId: "removed",
        answers: {},
        cursor: 2,
      }),
    ).toBe(3);
    expect(
      getVisibleRouteTotal({
        blocks,
        currentBlockId: null,
        answers: {},
        cursor: 2,
      }),
    ).toBe(1);
  });

  test("whitespace-only and empty-array answers do not count as progress", () => {
    expect(
      hasRunnerProgress({
        answers: { a: "   ", b: [] },
        cursor: 0,
        historyLength: 1,
        initialHistoryLength: 1,
      }),
    ).toBe(false);
    expect(
      hasRunnerProgress({
        answers: { b: ["x"] },
        cursor: 0,
        historyLength: 1,
        initialHistoryLength: 1,
      }),
    ).toBe(true);
  });
});
