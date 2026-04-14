import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import {
  advanceRunnerRoute,
  createInitialRunnerRoute,
  getCurrentRouteBlockId,
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
});
