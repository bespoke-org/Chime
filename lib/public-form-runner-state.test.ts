import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import { resolveNextBlockId, resolveVisitedBlockIds } from "@/lib/branching";
import { resolvePages } from "@/lib/pages";
import {
  advanceRunnerRoute,
  createInitialRunnerRoute,
  encodeRunnerRouteStep,
  getCurrentRouteBlockId,
  getExitProjectionIndex,
  getRouteCursor,
  getVisibleStepTotal,
  hasRunnerProgress,
  parseRunnerRouteStep,
  planPageInstances,
  resolveLandingPage,
  resolveNextRouteStep,
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
    pageId: overrides.pageId ?? null,
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

  test("changing an earlier answer onto another branch truncates history", () => {
    const answers = { path: "no", fallback: "a", extra: "b" };
    let route = createInitialRunnerRoute(branchingBlocks);
    route = advanceRunnerRoute(route, "path", "fallback");
    route = advanceRunnerRoute(route, "fallback", "extra");
    route = advanceRunnerRoute(route, "extra", "finish");
    route = { ...route, cursor: 0 };

    const switched = { ...answers, path: "yes" };
    const next = resolveNextBlockId(branchingBlocks, "path", switched);
    route = advanceRunnerRoute(route, "path", next ?? "fallback");

    expect(JSON.stringify(route.history)).toBe(
      JSON.stringify(["path", "finish"]),
    );
    expect(route.cursor).toBe(1);
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

  test("a terminal block has no next step", () => {
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

describe("runner steps of repeating pages", () => {
  // count(page 1) -> members(page 2, repeating by the count) -> note(page 3)
  function createRepeatingPages() {
    return resolvePages(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
        }),
        createBlock({
          id: "member",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "members-page",
        }),
        createBlock({
          id: "note",
          type: "LONG_TEXT",
          position: 2,
          pageId: "note-page",
        }),
      ],
      [
        { id: "count-page" },
        { id: "members-page", repeat: { countBlockId: "count" } },
        { id: "note-page" },
      ],
    );
  }

  test("encodes and parses instance steps", () => {
    expect(encodeRunnerRouteStep({ pageId: "members", instanceIndex: 0 })).toBe(
      "members",
    );
    expect(encodeRunnerRouteStep({ pageId: "members", instanceIndex: 2 })).toBe(
      "members#2",
    );
    expect(parseRunnerRouteStep("members")).toEqual({
      pageId: "members",
      instanceIndex: 0,
    });
    expect(parseRunnerRouteStep("members#3")).toEqual({
      pageId: "members",
      instanceIndex: 3,
    });
    expect(parseRunnerRouteStep("members#0")).toBe(null);
    expect(parseRunnerRouteStep("members#x")).toBe(null);
    expect(parseRunnerRouteStep("")).toBe(null);
  });

  test("plans a page by the count answer", () => {
    const pages = createRepeatingPages();
    const members = pages.find((page) => page.id === "members-page");
    const count = pages.find((page) => page.id === "count-page");
    const note = pages.find((page) => page.id === "note-page");

    expect(planPageInstances(members as never, pages, { count: "3" })).toEqual({
      kind: "instances",
      count: 3,
    });
    expect(planPageInstances(members as never, pages, { count: "0" })).toEqual({
      kind: "skipped",
    });
    expect(
      planPageInstances(members as never, pages, { count: "2.5" }),
    ).toEqual({ kind: "blocked", status: "invalid" });
    expect(planPageInstances(members as never, pages, {})).toEqual({
      kind: "blocked",
      status: "missing",
    });
    expect(planPageInstances(count as never, pages, {})).toEqual({
      kind: "single",
    });
    expect(planPageInstances(note as never, pages, {})).toEqual({
      kind: "single",
    });
  });

  test("walks the instances of a page then lands on the next page", () => {
    const pages = createRepeatingPages();

    const first = resolveNextRouteStep({
      pages,
      pageId: "count-page",
      instanceIndex: 0,
      projectionIndex: 0,
      answers: { count: "2" },
    });
    expect(first).toEqual({ pageId: "members-page", instanceIndex: 0 });

    const second = resolveNextRouteStep({
      pages,
      pageId: "members-page",
      instanceIndex: 0,
      projectionIndex: 0,
      answers: { count: "2" },
    });
    expect(second).toEqual({ pageId: "members-page", instanceIndex: 1 });

    const third = resolveNextRouteStep({
      pages,
      pageId: "members-page",
      instanceIndex: 1,
      projectionIndex: 1,
      answers: { count: "2" },
    });
    expect(third).toEqual({ pageId: "note-page", instanceIndex: 0 });

    const end = resolveNextRouteStep({
      pages,
      pageId: "note-page",
      instanceIndex: 0,
      projectionIndex: 1,
      answers: { count: "2" },
    });
    expect(end).toBe(null);
  });

  test("a count of zero skips the repeating page", () => {
    const pages = createRepeatingPages();

    const step = resolveNextRouteStep({
      pages,
      pageId: "count-page",
      instanceIndex: 0,
      projectionIndex: 0,
      answers: { count: "0" },
    });

    expect(step).toEqual({ pageId: "note-page", instanceIndex: 0 });
  });

  test("the exit of a page skipped by a count of 0 ignores its stale answers", () => {
    const pages = resolvePages(
      [
        createBlock({
          id: "count",
          type: "NUMBER",
          position: 0,
          pageId: "count-page",
        }),
        createBlock({
          id: "member",
          type: "SHORT_TEXT",
          position: 1,
          pageId: "members-page",
          config: {
            placeholder: "",
            validationRegex: null,
            branchRules: [
              { operator: "equals", value: "vip", targetBlockId: "vip" },
            ],
            defaultNextBlockId: null,
          },
        }),
        createBlock({
          id: "note",
          type: "LONG_TEXT",
          position: 2,
          pageId: "note-page",
        }),
        createBlock({
          id: "vip",
          type: "SHORT_TEXT",
          position: 3,
          pageId: "vip-page",
        }),
      ],
      [
        { id: "count-page" },
        { id: "members-page", repeat: { countBlockId: "count" } },
        { id: "note-page" },
        { id: "vip-page" },
      ],
    );

    // The respondent filled both instances, then dropped the count to 0.
    // The browser keeps the extra answers, but the skipped page's exit must
    // not see them, matching the server-side walk.
    const stale = { count: "0", member: ["regular", "vip"] };

    expect(
      resolveLandingPage({
        pages,
        exitPageId: "count-page",
        projectionIndex: 0,
        answers: stale,
      }),
    ).toEqual({ pageId: "note-page", nextProjectionIndex: 0 });
    expect(
      resolveNextRouteStep({
        pages,
        pageId: "count-page",
        instanceIndex: 0,
        projectionIndex: 0,
        answers: stale,
      }),
    ).toEqual({ pageId: "note-page", instanceIndex: 0 });

    // While the page runs, the last instance's answer still routes the exit.
    expect(
      resolveNextRouteStep({
        pages,
        pageId: "members-page",
        instanceIndex: 1,
        projectionIndex: 1,
        answers: { count: "2", member: ["regular", "vip"] },
      }),
    ).toEqual({ pageId: "vip-page", instanceIndex: 0 });
  });

  test("counts steps for progress", () => {
    const pages = createRepeatingPages();

    const total = getVisibleStepTotal({
      route: { history: ["count-page"], cursor: 0 },
      pages,
      answers: { count: "3" },
    });

    // count step, three member steps, note step
    expect(total).toBe(5);
  });

  test("an unanswered future count contributes one step", () => {
    const pages = createRepeatingPages();

    const total = getVisibleStepTotal({
      route: { history: ["count-page"], cursor: 0 },
      pages,
      answers: {},
    });

    expect(total).toBe(3);
  });

  test("projects the exit on the last instance of the visited route", () => {
    const pages = createRepeatingPages();
    const route = {
      history: ["count-page", "members-page", "members-page#1"],
      cursor: 2,
    };

    expect(getExitProjectionIndex({ route, pages })).toBe(1);
  });
});
