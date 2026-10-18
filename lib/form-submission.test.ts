import { describe, expect, test } from "bun:test";

import { parseBlockConfig, type SerializedBlock } from "@/lib/blocks";
import { AppError } from "@/lib/errors";
import {
  assertReorderMatchesForm,
  buildSubmission,
  parseSubmissionPayload,
} from "@/lib/form-submission";

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
                  allowFloat: true,
                  min: null,
                  max: null,
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

function positioned(blocks: SerializedBlock[]) {
  return blocks.map((block, index) => ({ ...block, position: index }));
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function captureError(fn: () => unknown) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

function appErrorStatus(error: unknown) {
  return error instanceof AppError ? error.status : null;
}

function appErrorMessage(error: unknown) {
  return error instanceof AppError ? error.message : null;
}

const yesNoBranch = (yesTarget: string) =>
  createBlock({
    id: "gate",
    type: "SINGLE_CHOICE",
    config: {
      options: ["yes", "no"],
      branchRules: [
        { operator: "equals", value: "yes", targetBlockId: yesTarget },
      ],
      defaultNextBlockId: null,
    },
  });

describe("buildSubmission routing", () => {
  test("drops answers for blocks outside the branch route and does not require them", () => {
    const blocks = positioned([
      yesNoBranch("after"),
      createBlock({ id: "skipped", type: "SHORT_TEXT", required: true }),
      createBlock({ id: "after", type: "SHORT_TEXT" }),
    ]);

    const result = buildSubmission(blocks, {
      gate: "yes",
      skipped: "should vanish",
      after: "kept",
    });

    expect(json(result.normalizedAnswers)).toBe(
      json({ gate: "yes", after: "kept" }),
    );
    expect(json(result.snapshot.map((block) => block.id))).toBe(
      json(["gate", "after"]),
    );
  });

  test("requires an answer only for required blocks on the route", () => {
    const blocks = positioned([
      yesNoBranch("after"),
      createBlock({ id: "skipped", type: "SHORT_TEXT", required: true }),
      createBlock({
        id: "after",
        type: "SHORT_TEXT",
        required: true,
        title: "Your name",
      }),
    ]);

    expect(
      captureError(() => buildSubmission(blocks, { gate: "yes", after: "x" })),
    ).toBe(null);

    const error = captureError(() => buildSubmission(blocks, { gate: "yes" }));

    expect(appErrorStatus(error)).toBe(422);
    expect(appErrorMessage(error)).toBe("Please answer “Your name”.");
  });

  test("falls back to a generic label for an untitled required block", () => {
    const blocks = positioned([
      createBlock({ id: "q", type: "NUMBER", required: true, title: "" }),
    ]);

    const error = captureError(() => buildSubmission(blocks, {}));

    expect(appErrorMessage(error)).toBe(
      "Please enter a number for “this question”.",
    );
  });

  test("branches on the normalized answer, not the raw one", () => {
    const blocks = positioned([
      createBlock({
        id: "amount",
        type: "NUMBER",
        config: {
          placeholder: "",
          allowFloat: true,
          min: null,
          max: null,
          branchRules: [{ operator: "gt", value: "12", targetBlockId: "big" }],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "small", type: "SHORT_TEXT" }),
      createBlock({ id: "big", type: "SHORT_TEXT" }),
    ]);

    const result = buildSubmission(blocks, { amount: " 12,5 " });

    expect(result.normalizedAnswers.amount).toBe("12.5");
    expect(json(result.snapshot.map((block) => block.id))).toBe(
      json(["amount", "big"]),
    );
  });

  test("matches an exact text rule after trimming the answer", () => {
    const blocks = positioned([
      createBlock({
        id: "code",
        type: "SHORT_TEXT",
        config: {
          placeholder: "",
          validationRegex: null,
          branchRules: [
            { operator: "equals", value: "vip", targetBlockId: "vip" },
          ],
          defaultNextBlockId: null,
        },
      }),
      createBlock({ id: "regular", type: "SHORT_TEXT" }),
      createBlock({ id: "vip", type: "SHORT_TEXT" }),
    ]);

    const result = buildSubmission(blocks, { code: "  vip  " });

    expect(json(result.snapshot.map((block) => block.id))).toBe(
      json(["code", "vip"]),
    );
  });

  test("returns an empty submission for a form without blocks", () => {
    const result = buildSubmission([], { ghost: "value" });

    expect(json(result.normalizedAnswers)).toBe(json({}));
    expect(json(result.snapshot)).toBe(json([]));
  });

  test("walks a text-only chain and records every block without answers", () => {
    const blocks = positioned([
      createBlock({ id: "a", type: "TEXT" }),
      createBlock({ id: "b", type: "TEXT" }),
      createBlock({ id: "c", type: "TEXT" }),
    ]);

    const result = buildSubmission(blocks, { a: "ignored", b: "ignored" });

    expect(json(result.normalizedAnswers)).toBe(json({}));
    expect(json(result.snapshot.map((block) => block.id))).toBe(
      json(["a", "b", "c"]),
    );
  });

  test("stops at a terminal block in the middle of the route", () => {
    const blocks = positioned([
      createBlock({ id: "first", type: "SHORT_TEXT" }),
      createBlock({
        id: "stop",
        type: "SHORT_TEXT",
        config: {
          placeholder: "",
          validationRegex: null,
          branchRules: [],
          defaultNextBlockId: null,
          endForm: true,
        },
      }),
      createBlock({ id: "never", type: "SHORT_TEXT", required: true }),
    ]);

    const result = buildSubmission(blocks, { first: "a", stop: "b" });

    expect(json(result.snapshot.map((block) => block.id))).toBe(
      json(["first", "stop"]),
    );
  });

  test("ignores unknown block ids and values sent for text blocks", () => {
    const blocks = positioned([
      createBlock({ id: "intro", type: "TEXT" }),
      createBlock({ id: "name", type: "SHORT_TEXT" }),
    ]);

    const result = buildSubmission(blocks, {
      intro: "hello",
      name: "Ada",
      "does-not-exist": "x",
    });

    expect(json(result.normalizedAnswers)).toBe(json({ name: "Ada" }));
  });
});

describe("buildSubmission snapshot", () => {
  test("captures visited blocks in visit order with only the snapshot fields", () => {
    const blocks = positioned([
      yesNoBranch("after"),
      createBlock({ id: "skipped", type: "SHORT_TEXT" }),
      createBlock({
        id: "after",
        type: "SHORT_TEXT",
        title: "After",
        description: "Follow-up",
        required: true,
      }),
    ]);

    const result = buildSubmission(blocks, { gate: "yes", after: "x" });

    expect(json(Object.keys(result.snapshot[0]).sort())).toBe(
      json([
        "config",
        "description",
        "id",
        "position",
        "required",
        "title",
        "type",
      ]),
    );
    expect(json(result.snapshot[1])).toBe(
      json({
        id: "after",
        type: "SHORT_TEXT",
        title: "After",
        description: "Follow-up",
        required: true,
        position: 2,
        config: blocks[2].config,
      }),
    );
  });
});

describe("buildSubmission with a form edited after publishing", () => {
  test("terminates when a rule points backward after a reorder", () => {
    // Blocks were reordered so "gate" now sits after its own target.
    const blocks = positioned([
      createBlock({ id: "target", type: "SHORT_TEXT" }),
      yesNoBranch("target"),
      createBlock({ id: "tail", type: "SHORT_TEXT" }),
    ]);

    const result = buildSubmission(blocks, {
      target: "a",
      gate: "yes",
      tail: "b",
    });

    expect(json(result.snapshot.map((block) => block.id))).toBe(
      json(["target", "gate", "tail"]),
    );
  });

  test("rejects an option that was renamed while the respondent was answering", () => {
    const blocks = positioned([
      createBlock({
        id: "choice",
        type: "SINGLE_CHOICE",
        title: "Pick",
        config: {
          options: ["yes", "no"],
          branchRules: [],
          defaultNextBlockId: null,
        },
      }),
    ]);

    const error = captureError(() =>
      buildSubmission(blocks, { choice: "maybe" }),
    );

    expect(appErrorStatus(error)).toBe(422);
    expect(appErrorMessage(error)).toBe("Invalid option submitted for “Pick”.");
  });

  test("ignores an answer for a block that was deleted", () => {
    const blocks = positioned([
      createBlock({ id: "name", type: "SHORT_TEXT" }),
    ]);

    const result = buildSubmission(blocks, { name: "Ada", deleted: "old" });

    expect(json(result.normalizedAnswers)).toBe(json({ name: "Ada" }));
  });

  test("rejects a single-choice answer once the block became multiple choice", () => {
    const blocks = positioned([
      createBlock({
        id: "choice",
        type: "MULTIPLE_CHOICE",
        config: {
          options: ["red", "blue"],
          branchRules: [],
          defaultNextBlockId: null,
        },
      }),
    ]);

    const error = captureError(() =>
      buildSubmission(blocks, { choice: "red" }),
    );

    expect(appErrorStatus(error)).toBe(422);
  });
});

describe("parseSubmissionPayload", () => {
  test("accepts strings and string arrays keyed by block id", () => {
    const parsed = parseSubmissionPayload({ a: "x", b: ["y", "z"], c: [] });

    expect(json(parsed)).toBe(json({ a: "x", b: ["y", "z"], c: [] }));
  });

  test("rejects payloads that are not plain objects with a 422 app error", () => {
    for (const payload of [null, undefined, [], "answers", 42, true]) {
      const error = captureError(() => parseSubmissionPayload(payload));

      expect(error instanceof AppError).toBe(true);
      expect(appErrorStatus(error)).toBe(422);
    }
  });

  test("rejects answer values that are not strings or string arrays", () => {
    for (const value of [42, { v: "x" }, null, [1, 2], ["ok", 3], true]) {
      expect(
        appErrorStatus(
          captureError(() => parseSubmissionPayload({ q: value })),
        ),
      ).toBe(422);
    }
  });
});

describe("assertReorderMatchesForm", () => {
  const current = ["a", "b", "c"];

  test("accepts the same ids in a different order", () => {
    expect(
      captureError(() => assertReorderMatchesForm(current, ["c", "a", "b"])),
    ).toBe(null);
  });

  test("rejects a missing, extra, duplicated or empty id list with 409", () => {
    for (const next of [
      ["a", "b"],
      ["a", "b", "c", "d"],
      ["a", "a", "b"],
      [],
      ["a", "b", "x"],
    ]) {
      const error = captureError(() => assertReorderMatchesForm(current, next));

      expect(appErrorStatus(error)).toBe(409);
      expect(appErrorMessage(error)).toBe(
        "Block reorder payload is out of sync with the current form.",
      );
    }
  });

  test("does not mutate the input arrays", () => {
    const next = ["c", "a", "b"];

    assertReorderMatchesForm(current, next);

    expect(json(current)).toBe(json(["a", "b", "c"]));
    expect(json(next)).toBe(json(["c", "a", "b"]));
  });
});

describe("buildSubmission rating blocks", () => {
  const ratingConfig = parseBlockConfig("RATING", {
    branchRules: [{ operator: "gte", value: "4", targetBlockId: "praise" }],
  });

  test("asks for a rating when a required rating is missing", () => {
    const blocks = positioned([
      createBlock({
        id: "score",
        type: "RATING",
        required: true,
        title: "How was it?",
        config: ratingConfig,
      }),
    ]);

    const error = captureError(() => buildSubmission(blocks, {}));

    expect(appErrorStatus(error)).toBe(422);
    expect(appErrorMessage(error)).toBe(
      "Please choose a rating for “How was it?”.",
    );
  });

  test("rejects a rating outside the scale and stores the normalized one", () => {
    const blocks = positioned([
      createBlock({ id: "score", type: "RATING", config: ratingConfig }),
      createBlock({ id: "complaint", type: "SHORT_TEXT" }),
      createBlock({ id: "praise", type: "SHORT_TEXT" }),
    ]);

    expect(
      appErrorStatus(
        captureError(() => buildSubmission(blocks, { score: "6" })),
      ),
    ).toBe(422);

    const result = buildSubmission(blocks, { score: " 4,0 " });

    expect(result.normalizedAnswers.score).toBe("4");
    expect(json(result.snapshot.map((block) => block.id))).toBe(
      json(["score", "praise"]),
    );
  });
});

describe("buildSubmission file upload blocks", () => {
  test("names the question when a required file is missing", () => {
    const blocks = [
      createBlock({
        id: "cv",
        type: "FILE_UPLOAD",
        title: "Your CV",
        required: true,
        config: parseBlockConfig("FILE_UPLOAD", {}),
      }),
    ];

    try {
      buildSubmission(blocks, {});
      expect(false).toBe(true);
    } catch (error) {
      expect(error instanceof AppError).toBe(true);
      expect((error as Error).message).toBe(
        "Please attach a file for “Your CV”.",
      );
    }
  });

  test("keeps the upload id as the answer", () => {
    const blocks = [
      createBlock({
        id: "cv",
        type: "FILE_UPLOAD",
        config: parseBlockConfig("FILE_UPLOAD", {}),
      }),
    ];

    expect(
      JSON.stringify(buildSubmission(blocks, { cv: "up1" }).normalizedAnswers),
    ).toBe(JSON.stringify({ cv: "up1" }));
  });
});
