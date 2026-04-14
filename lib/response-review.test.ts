import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import {
  buildResponseDetailData,
  buildResponseReviewData,
} from "@/lib/response-review";

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

describe("buildResponseReviewData", () => {
  test("counts reached, skipped, choice, and number summaries from visited routes", () => {
    const blocks = [
      createBlock({
        id: "path",
        type: "SINGLE_CHOICE",
        position: 0,
        config: {
          options: ["yes", "no"],
          branchRules: [],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "follow-up", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "score", type: "NUMBER", position: 2 }),
    ];

    const responseData = buildResponseReviewData({
      form: {
        id: "form-1",
        title: "Survey",
        workspace: { kind: "personal", label: "Personal workspace" },
        blocks,
      },
      responses: [
        {
          id: "response-1",
          submittedAt: new Date("2026-04-14T10:00:00.000Z"),
          answersJson: { path: "yes", score: "10" },
          formSnapshotJson: [
            {
              id: "path",
              type: "SINGLE_CHOICE",
              title: "path",
              description: "",
              required: false,
              position: 0,
              config: { options: ["yes", "no"] },
            },
            {
              id: "score",
              type: "NUMBER",
              title: "score",
              description: "",
              required: false,
              position: 2,
              config: {},
            },
          ],
        },
        {
          id: "response-2",
          submittedAt: new Date("2026-04-14T11:00:00.000Z"),
          answersJson: { path: "no", "follow-up": "Ada", score: "20" },
          formSnapshotJson: [
            {
              id: "path",
              type: "SINGLE_CHOICE",
              title: "path",
              description: "",
              required: false,
              position: 0,
              config: { options: ["yes", "no"] },
            },
            {
              id: "follow-up",
              type: "SHORT_TEXT",
              title: "follow-up",
              description: "",
              required: false,
              position: 1,
              config: {},
            },
            {
              id: "score",
              type: "NUMBER",
              title: "score",
              description: "",
              required: false,
              position: 2,
              config: {},
            },
          ],
        },
      ],
    });

    expect(responseData.responses.length).toBe(2);
    expect(responseData.responses[0]?.id).toBe("response-2");

    const pathSummary = responseData.questionSummaries.find(
      (summary) => summary.block.id === "path",
    );
    const followUpSummary = responseData.questionSummaries.find(
      (summary) => summary.block.id === "follow-up",
    );
    const scoreSummary = responseData.questionSummaries.find(
      (summary) => summary.block.id === "score",
    );

    expect(pathSummary?.kind).toBe("choice");
    expect(pathSummary?.reachedCount).toBe(2);
    expect(pathSummary?.answeredCount).toBe(2);
    expect(
      pathSummary?.kind === "choice"
        ? pathSummary.optionCounts.find((option) => option.value === "yes")
            ?.count
        : null,
    ).toBe(1);
    expect(
      pathSummary?.kind === "choice"
        ? pathSummary.optionCounts.find((option) => option.value === "no")
            ?.count
        : null,
    ).toBe(1);

    expect(followUpSummary?.reachedCount).toBe(1);
    expect(followUpSummary?.answeredCount).toBe(1);
    expect(followUpSummary?.skippedCount).toBe(1);

    expect(scoreSummary?.kind).toBe("number");
    expect(scoreSummary?.reachedCount).toBe(2);
    expect(scoreSummary?.kind === "number" ? scoreSummary.min : null).toBe(10);
    expect(scoreSummary?.kind === "number" ? scoreSummary.max : null).toBe(20);
    expect(scoreSummary?.kind === "number" ? scoreSummary.average : null).toBe(
      15,
    );
  });
});

describe("buildResponseDetailData", () => {
  test("marks current route blocks as visited or skipped while showing visited snapshot blocks", () => {
    const currentBlocks = [
      createBlock({ id: "path", type: "SINGLE_CHOICE", position: 0 }),
      createBlock({ id: "follow-up", type: "SHORT_TEXT", position: 1 }),
      createBlock({ id: "score", type: "NUMBER", position: 2 }),
    ];

    const detail = buildResponseDetailData({
      responseId: "response-1",
      formId: "form-1",
      submittedAt: new Date("2026-04-14T10:00:00.000Z"),
      submissionNumber: 1,
      formTitle: "Survey",
      workspace: { kind: "personal", label: "Personal workspace" },
      answersJson: { path: "yes", score: "10" },
      formSnapshotJson: [
        {
          id: "path",
          type: "SINGLE_CHOICE",
          title: "Path at submit time",
          description: "",
          required: false,
          position: 0,
          config: { options: ["yes", "no"] },
        },
        {
          id: "score",
          type: "NUMBER",
          title: "Score at submit time",
          description: "",
          required: false,
          position: 2,
          config: {},
        },
      ],
      currentBlocks,
    });

    expect(JSON.stringify(detail.blocks.map((block) => block.id))).toBe(
      JSON.stringify(["path", "score"]),
    );
    expect(detail.blocks[0]?.title).toBe("Path at submit time");
    expect(
      JSON.stringify(
        detail.routeBlocks.map((entry) => ({
          id: entry.block.id,
          status: entry.status,
        })),
      ),
    ).toBe(
      JSON.stringify([
        { id: "path", status: "visited" },
        { id: "follow-up", status: "skipped" },
        { id: "score", status: "visited" },
      ]),
    );
  });

  test("falls back to current blocks when snapshot data is malformed", () => {
    const currentBlocks = [
      createBlock({ id: "first", type: "SHORT_TEXT", position: 0 }),
      createBlock({ id: "second", type: "SHORT_TEXT", position: 1 }),
    ];

    const detail = buildResponseDetailData({
      responseId: "response-1",
      formId: "form-1",
      submittedAt: new Date("2026-04-14T10:00:00.000Z"),
      submissionNumber: 1,
      formTitle: "Survey",
      workspace: { kind: "personal", label: "Personal workspace" },
      answersJson: { first: "Ada" },
      formSnapshotJson: { invalid: true },
      currentBlocks,
    });

    expect(JSON.stringify(detail.blocks.map((block) => block.id))).toBe(
      JSON.stringify(["first", "second"]),
    );
    expect(
      detail.routeBlocks.every((entry) => entry.status === "visited"),
    ).toBe(true);
  });
});
