import { describe, expect, test } from "bun:test";

import type { SerializedBlock } from "@/lib/blocks";
import { buildSubmission } from "@/lib/form-submission";
import {
  buildResponseDetailData,
  buildResponseReviewData,
  resolveStoredAnswerView,
  groupResponseDetailBlocks,
  restoreVisitedBlocksFromSnapshot,
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
        slug: "survey",
        status: "PUBLISHED",
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

describe("stored answer views of repeating blocks", () => {
  test("reads the answered instances of a scalar block and drops holes", () => {
    const block = createBlock({ id: "note", type: "SHORT_TEXT", position: 0 });
    const view = resolveStoredAnswerView(block, ["first", null, "third"]);

    expect(view.kind).toBe("instances");
    expect(view.kind === "instances" ? JSON.stringify(view.entries) : "").toBe(
      JSON.stringify([
        { value: "first", instanceIndex: 0 },
        { value: "third", instanceIndex: 2 },
      ]),
    );
  });

  test("keeps each multiple-choice instance's selections", () => {
    const block = createBlock({
      id: "toppings",
      type: "MULTIPLE_CHOICE",
      position: 0,
    });
    const view = resolveStoredAnswerView(block, [
      ["olives", "cheese"],
      null,
      ["olives"],
    ]);

    expect(view.kind).toBe("instances");
    expect(view.kind === "instances" ? JSON.stringify(view.entries) : "").toBe(
      JSON.stringify([
        { value: ["olives", "cheese"], instanceIndex: 0 },
        { value: ["olives"], instanceIndex: 2 },
      ]),
    );
  });

  test("leaves flat answers and empty instance arrays alone", () => {
    const choice = createBlock({
      id: "toppings",
      type: "MULTIPLE_CHOICE",
      position: 0,
    });
    const text = createBlock({ id: "note", type: "SHORT_TEXT", position: 0 });

    expect(resolveStoredAnswerView(choice, ["olives", "cheese"]).kind).toBe(
      "flat",
    );
    expect(resolveStoredAnswerView(text, "Ada").kind).toBe("flat");
    expect(resolveStoredAnswerView(text, undefined).kind).toBe("flat");

    const empty = resolveStoredAnswerView(text, []);
    expect(empty.kind).toBe("instances");
    expect(empty.kind === "instances" ? empty.entries.length : -1).toBe(0);
  });
});

describe("buildResponseDetailData", () => {
  test("shows visited blocks as they were at submit time", () => {
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
  });
});

describe("response identity", () => {
  const nameBlock = createBlock({
    id: "name",
    type: "SHORT_TEXT",
    title: "Name",
    position: 0,
    config: {
      placeholder: "",
      validationRegex: null,
      identity: true,
      identityKey: null,
      branchRules: [],
      defaultNextBlockId: null,
    },
  });
  const handleBlock = createBlock({
    id: "handle",
    type: "SHORT_TEXT",
    title: "Telegram",
    position: 1,
    config: {
      placeholder: "",
      validationRegex: null,
      identity: true,
      identityKey: "telegram",
      branchRules: [],
      defaultNextBlockId: null,
    },
  });
  const noteBlock = createBlock({
    id: "note",
    type: "SHORT_TEXT",
    position: 2,
  });

  test("lists answered identity fields in block order on the response row", () => {
    const data = buildResponseReviewData({
      form: {
        id: "form-1",
        title: "Survey",
        slug: "survey",
        status: "PUBLISHED",
        workspace: { kind: "personal", label: "Personal workspace" },
        blocks: [nameBlock, handleBlock, noteBlock],
      },
      responses: [
        {
          id: "response-1",
          submittedAt: new Date("2026-04-14T10:00:00.000Z"),
          answersJson: { handle: "@ada", name: "Ada Lovelace", note: "hi" },
          formSnapshotJson: null,
        },
        {
          id: "response-2",
          submittedAt: new Date("2026-04-14T11:00:00.000Z"),
          answersJson: { note: "anonymous" },
          formSnapshotJson: null,
        },
      ],
    });

    expect(JSON.stringify(data.responses.map((row) => row.identity))).toBe(
      JSON.stringify([
        [],
        [
          { key: null, blockId: "name", title: "Name", value: "Ada Lovelace" },
          {
            key: "telegram",
            blockId: "handle",
            title: "Telegram",
            value: "@ada",
          },
        ],
      ]),
    );
  });

  test("reads identity from the response detail", () => {
    const detail = buildResponseDetailData({
      responseId: "response-1",
      formId: "form-1",
      submittedAt: new Date("2026-04-14T10:00:00.000Z"),
      submissionNumber: 1,
      formTitle: "Survey",
      workspace: { kind: "personal", label: "Personal workspace" },
      answersJson: { handle: "@ada" },
      formSnapshotJson: null,
      currentBlocks: [nameBlock, handleBlock, noteBlock],
    });

    expect(detail.identity.map((entry) => entry.value).join()).toBe("@ada");
  });

  test("reads identity flags from the current blocks, not the snapshot", () => {
    const detail = buildResponseDetailData({
      responseId: "response-1",
      formId: "form-1",
      submittedAt: new Date("2026-04-14T10:00:00.000Z"),
      submissionNumber: 1,
      formTitle: "Survey",
      workspace: { kind: "personal", label: "Personal workspace" },
      answersJson: { name: "Ada Lovelace" },
      formSnapshotJson: [
        {
          id: "name",
          type: "SHORT_TEXT",
          title: "Name",
          description: "",
          required: false,
          position: 0,
          config: { identity: false },
        },
      ],
      currentBlocks: [nameBlock],
    });

    expect(detail.identity.map((entry) => entry.value).join()).toBe(
      "Ada Lovelace",
    );
  });
});

describe("rating question summaries", () => {
  const ratingConfig = {
    min: 0,
    max: 3,
    minLabel: "Low",
    maxLabel: "High",
    branchRules: [],
    defaultNextBlockId: null,
  };

  function snapshot(blockIds: string[]) {
    return blockIds.map((id, index) => ({
      id,
      type: id === "score" ? "RATING" : "SHORT_TEXT",
      title: id,
      description: "",
      required: false,
      position: index,
      config: id === "score" ? ratingConfig : {},
    }));
  }

  function summarize(
    responses: Array<{ id: string; answers: Record<string, unknown> }>,
  ) {
    return buildResponseReviewData({
      form: {
        id: "form-1",
        title: "Survey",
        slug: "survey",
        status: "PUBLISHED",
        workspace: { kind: "personal", label: "Personal workspace" },
        blocks: [
          createBlock({ id: "name", type: "SHORT_TEXT", position: 0 }),
          createBlock({
            id: "score",
            type: "RATING",
            position: 1,
            config: ratingConfig,
          }),
        ],
      },
      responses: responses.map((response) => ({
        id: response.id,
        submittedAt: new Date("2026-04-14T10:00:00.000Z"),
        answersJson: response.answers,
        formSnapshotJson: snapshot(
          "score" in response.answers || response.id.startsWith("reached")
            ? ["name", "score"]
            : ["name"],
        ),
      })),
    }).questionSummaries.find((summary) => summary.block.id === "score");
  }

  test("counts every scale value, including zero and unused ones", () => {
    const summary = summarize([
      { id: "reached-1", answers: { score: "0" } },
      { id: "reached-2", answers: { score: "3" } },
      { id: "reached-3", answers: { score: "3" } },
      { id: "reached-4", answers: { score: "1" } },
    ]);

    expect(summary?.kind).toBe("number");
    expect(summary?.kind === "number" ? summary.average : null).toBe(1.75);
    expect(summary?.kind === "number" ? summary.min : null).toBe(0);
    expect(summary?.kind === "number" ? summary.max : null).toBe(3);
    expect(
      summary?.kind === "number" ? JSON.stringify(summary.distribution) : "",
    ).toBe(
      JSON.stringify([
        { value: "0", count: 1 },
        { value: "1", count: 1 },
        { value: "2", count: 0 },
        { value: "3", count: 2 },
      ]),
    );
  });

  test("ignores missing, blank and malformed answers in the aggregates", () => {
    const summary = summarize([
      { id: "reached-1", answers: { score: "2" } },
      { id: "reached-2", answers: {} },
      { id: "reached-3", answers: { score: "  " } },
      { id: "reached-4", answers: { score: "high" } },
      { id: "skipped-1", answers: { name: "Ada" } },
    ]);

    expect(summary?.reachedCount).toBe(4);
    expect(summary?.answeredCount).toBe(2);
    expect(summary?.emptyCount).toBe(2);
    expect(summary?.skippedCount).toBe(1);
    expect(summary?.kind === "number" ? summary.average : null).toBe(2);
    expect(
      summary?.kind === "number"
        ? JSON.stringify(summary.distribution?.map((entry) => entry.count))
        : "",
    ).toBe(JSON.stringify([0, 0, 1, 0]));
  });

  test("reports an empty summary when nobody rated", () => {
    const summary = summarize([{ id: "skipped-1", answers: { name: "Ada" } }]);

    expect(summary?.kind === "number" ? summary.average : undefined).toBe(null);
    expect(summary?.kind === "number" ? summary.min : undefined).toBe(null);
    expect(
      summary?.kind === "number"
        ? JSON.stringify(summary.distribution?.map((entry) => entry.count))
        : "",
    ).toBe(JSON.stringify([0, 0, 0, 0]));
  });

  test("leaves number blocks without a distribution", () => {
    const summary = buildResponseReviewData({
      form: {
        id: "form-1",
        title: "Survey",
        slug: "survey",
        status: "PUBLISHED",
        workspace: { kind: "personal", label: "Personal workspace" },
        blocks: [createBlock({ id: "age", type: "NUMBER", position: 0 })],
      },
      responses: [],
    }).questionSummaries[0];

    expect(summary?.kind === "number" ? typeof summary.distribution : "").toBe(
      "undefined",
    );
  });
});

describe("repeating question summaries", () => {
  const blocks = [
    createBlock({
      id: "dish",
      type: "SINGLE_CHOICE",
      position: 0,
      config: {
        options: ["pasta", "salad"],
        branchRules: [],
        defaultNextBlockId: null,
      },
    }),
    createBlock({
      id: "toppings",
      type: "MULTIPLE_CHOICE",
      position: 1,
      config: {
        options: ["olives", "cheese"],
        branchRules: [],
        defaultNextBlockId: null,
      },
    }),
    createBlock({ id: "score", type: "NUMBER", position: 2 }),
    createBlock({ id: "note", type: "SHORT_TEXT", position: 3 }),
  ];

  function snapshotOf(ids: string[]) {
    return ids.map((id) => ({
      id,
      type: "SHORT_TEXT" as const,
      title: id,
      description: "",
      required: false,
      position: 0,
      config: {},
    }));
  }

  function summarize(
    responses: Array<{ id: string; answersJson: unknown; ids: string[] }>,
  ) {
    return buildResponseReviewData({
      form: {
        id: "form-1",
        title: "Survey",
        slug: "survey",
        status: "PUBLISHED",
        workspace: { kind: "personal", label: "Personal workspace" },
        blocks,
      },
      responses: responses.map((response) => ({
        id: response.id,
        submittedAt: new Date("2026-04-14T10:00:00.000Z"),
        answersJson: response.answersJson,
        formSnapshotJson: snapshotOf(response.ids),
      })),
    }).questionSummaries;
  }

  test("counts every answered instance like a separate answer in the tallies", () => {
    const summaries = summarize([
      {
        id: "response-1",
        answersJson: {
          dish: ["pasta", "salad"],
          toppings: [["olives", "cheese"], ["olives"]],
          score: ["10", "20"],
          note: ["first", "second"],
        },
        ids: ["dish", "toppings", "score", "note"],
      },
      {
        id: "response-2",
        answersJson: { dish: ["pasta"], score: ["30"] },
        ids: ["dish", "toppings", "score", "note"],
      },
      { id: "response-3", answersJson: {}, ids: [] },
    ]);

    const dish = summaries.find((summary) => summary.block.id === "dish");
    expect(dish?.kind).toBe("choice");
    expect(dish?.reachedCount).toBe(2);
    expect(dish?.answeredCount).toBe(2);
    expect(dish?.emptyCount).toBe(0);
    expect(dish?.skippedCount).toBe(1);
    expect(
      dish?.kind === "choice" ? JSON.stringify(dish.optionCounts) : "",
    ).toBe(
      JSON.stringify([
        { value: "pasta", count: 2 },
        { value: "salad", count: 1 },
      ]),
    );

    const toppings = summaries.find(
      (summary) => summary.block.id === "toppings",
    );
    expect(toppings?.kind).toBe("choice");
    expect(toppings?.reachedCount).toBe(2);
    expect(toppings?.answeredCount).toBe(1);
    expect(toppings?.emptyCount).toBe(1);
    expect(
      toppings?.kind === "choice" ? JSON.stringify(toppings.optionCounts) : "",
    ).toBe(
      JSON.stringify([
        { value: "olives", count: 2 },
        { value: "cheese", count: 1 },
      ]),
    );

    const score = summaries.find((summary) => summary.block.id === "score");
    expect(score?.kind).toBe("number");
    expect(score?.reachedCount).toBe(2);
    expect(score?.answeredCount).toBe(2);
    expect(score?.kind === "number" ? score.min : null).toBe(10);
    expect(score?.kind === "number" ? score.max : null).toBe(30);
    expect(score?.kind === "number" ? score.average : null).toBe(20);

    const note = summaries.find((summary) => summary.block.id === "note");
    expect(note?.kind).toBe("freeform");
    expect(note?.reachedCount).toBe(2);
    expect(note?.answeredCount).toBe(1);
    expect(note?.emptyCount).toBe(1);
    expect(
      note?.kind === "freeform"
        ? JSON.stringify(
            note.answers.map((answer) => ({
              submissionNumber: answer.submissionNumber,
              value: answer.value,
            })),
          )
        : "",
    ).toBe(
      JSON.stringify([
        { submissionNumber: 1, value: "second" },
        { submissionNumber: 1, value: "first" },
      ]),
    );
  });

  test("keeps a repeating block with no answered instances empty but reached", () => {
    const summaries = summarize([
      {
        id: "response-1",
        answersJson: { note: [null] },
        ids: ["note"],
      },
    ]);

    const note = summaries.find((summary) => summary.block.id === "note");

    expect(note?.reachedCount).toBe(1);
    expect(note?.answeredCount).toBe(0);
    expect(note?.emptyCount).toBe(1);
    expect(note?.kind === "freeform" ? note.answers.length : -1).toBe(0);
  });
});

describe("response detail page grouping", () => {
  const blocks = [
    createBlock({ id: "count", type: "NUMBER", position: 0 }),
    createBlock({
      id: "name",
      type: "SHORT_TEXT",
      pageId: "team",
      position: 1,
    }),
    createBlock({
      id: "surname",
      type: "SHORT_TEXT",
      pageId: "team",
      position: 2,
    }),
    createBlock({
      id: "choices",
      type: "MULTIPLE_CHOICE",
      pageId: "team",
      position: 3,
    }),
  ];

  test("preserves submitted page membership and fully empty instances after form edits", () => {
    const submission = buildSubmission(
      blocks,
      { count: "3", name: ["Ann"], choices: [["red", "blue"]] },
      [{ id: "team", name: "Guests", repeat: { countBlockId: "count" } }],
    );
    const saved = JSON.parse(JSON.stringify(submission.snapshot));
    const restored = restoreVisitedBlocksFromSnapshot(
      saved,
      blocks.map((block) => ({ ...block, pageId: "changed" })),
      "form-1",
      new Date(),
    );
    const sections = groupResponseDetailBlocks(
      restored,
      submission.normalizedAnswers,
    );
    expect(sections.length).toBe(2);
    expect(sections[0].kind).toBe("block");
    expect(restored[0].pageId).toBe(null);
    const group = sections[1];
    expect(group.kind).toBe("repeatedPage");
    if (group.kind !== "repeatedPage") throw new Error("Missing group");
    expect(group.name).toBe("Guests");
    expect(group.instanceCount).toBe(3);
    expect(group.blocks.map((block) => block.id)).toEqual([
      "name",
      "surname",
      "choices",
    ]);
  });

  test("groups old snapshots by current membership and keeps independent pages separate", () => {
    const current = [
      ...blocks,
      createBlock({
        id: "other",
        type: "SHORT_TEXT",
        pageId: "other-page",
        position: 4,
      }),
      createBlock({ id: "deleted", type: "SHORT_TEXT", position: 5 }),
    ];
    const snapshot = current.map(({ pageId, ...block }) => {
      void pageId;
      return block;
    });
    const restored = restoreVisitedBlocksFromSnapshot(
      snapshot,
      current.slice(0, -1),
      "form-1",
      new Date(),
    );
    const sections = groupResponseDetailBlocks(restored, {
      count: "3",
      name: ["Ann", "", "Chris"],
      other: ["Separate"],
      deleted: ["Old"],
    });
    expect(
      sections.map((section) =>
        section.kind === "block" ? section.block.id : section.id,
      ),
    ).toEqual(["count", "team", "other-page", "deleted"]);
    const group = sections[1];
    if (group.kind !== "repeatedPage") throw new Error("Missing group");
    expect(group.instanceCount).toBe(3);
    expect(group.blocks.map((block) => block.id)).toEqual([
      "name",
      "surname",
      "choices",
    ]);
  });

  test("does not turn an ordinary multiple-choice answer into repeated rows", () => {
    const sections = groupResponseDetailBlocks(blocks, {
      choices: ["red", "blue"],
    });
    expect(sections.every((section) => section.kind === "block")).toBe(true);
  });
});
