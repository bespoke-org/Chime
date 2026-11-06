import { z } from "zod";

import {
  AGREEMENT_ANSWER_VALUES,
  blockTypeSchema,
  getRatingValues,
  isNumericAnswerBlock,
  isQuestionBlock,
  type ChoiceBlockConfig,
  type RatingBlockConfig,
  type SerializedBlock,
} from "@/lib/blocks";
import { normalizeBlockConfig } from "@/lib/block-config-normalization";
import { instanceAnswerEntries, type InstanceAnswerEntry } from "@/lib/repeat";
import { collectResponseIdentity } from "@/lib/response-identity";
import type {
  AnswerValue,
  QuestionSummary,
  QuestionSummaryAnswer,
  ResponseDetail,
  ResponseDetailUpload,
  ResponseListItem,
  ResponseReviewData,
  ResponseReviewFormSummary,
  StoredAnswerValue,
  WorkspaceReference,
} from "@/lib/form-types";

type StoredResponseLike = {
  id: string;
  submittedAt: Date;
  answersJson: unknown;
  formSnapshotJson: unknown;
};

const snapshotBlockSchema = z.object({
  id: z.string(),
  type: blockTypeSchema,
  title: z.string(),
  description: z.string(),
  required: z.boolean(),
  position: z.number(),
  config: z.unknown(),
});

export function parseStoredAnswers(
  answersJson: unknown,
): Record<string, StoredAnswerValue> {
  return typeof answersJson === "object" &&
    answersJson &&
    !Array.isArray(answersJson)
    ? (answersJson as Record<string, StoredAnswerValue>)
    : {};
}

// How review and export read a stored answer. A block of a repeating page
// stores one entry per instance; every other block keeps its flat shape. A
// response carries no page registry, so the nesting is read from the value
// itself: a flat scalar answer is a string and a flat multiple-choice answer
// holds only strings, so instance entries mark a repeating block (for multiple
// choice: arrays among the entries, because an unanswered instance between
// answered ones serializes as null).
export type StoredAnswerView =
  | { kind: "instances"; entries: InstanceAnswerEntry[] }
  | { kind: "flat"; value: string | string[] | undefined };

// A stored answer of a repeating block may carry null holes: JSON round-trips
// an unanswered instance as null.
export type StoredAnswerInput =
  | StoredAnswerValue
  | undefined
  | (string | null)[]
  | (string[] | null)[];

export function resolveStoredAnswerView(
  block: Pick<SerializedBlock, "type">,
  value: StoredAnswerInput,
): StoredAnswerView {
  if (
    Array.isArray(value) &&
    (block.type !== "MULTIPLE_CHOICE" ||
      value.some((instance) => Array.isArray(instance)))
  ) {
    return { kind: "instances", entries: instanceAnswerEntries(value) };
  }

  return {
    kind: "flat",
    value: Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : value,
  };
}

export function restoreVisitedBlocksFromSnapshot(
  formSnapshotJson: unknown,
  fallbackBlocks: SerializedBlock[],
  formId: string,
  submittedAt: Date,
) {
  const parsed = z.array(snapshotBlockSchema).safeParse(formSnapshotJson);

  if (!parsed.success) {
    return fallbackBlocks;
  }

  return parsed.data
    .sort((left, right) => left.position - right.position)
    .map(
      (block) =>
        ({
          id: block.id,
          type: block.type,
          title: block.title,
          description: block.description,
          required: block.required,
          position: block.position,
          pageId: null,
          formId,
          createdAt: submittedAt,
          updatedAt: submittedAt,
          config: normalizeBlockConfig(block.type, block.config),
        }) satisfies SerializedBlock,
    );
}

export function getVisitedBlockIds(
  formSnapshotJson: unknown,
  fallbackBlocks: SerializedBlock[],
) {
  const parsed = z.array(snapshotBlockSchema).safeParse(formSnapshotJson);

  if (!parsed.success) {
    return new Set(fallbackBlocks.map((block) => block.id));
  }

  return new Set(parsed.data.map((block) => block.id));
}

function hasRecordedAnswer(answer: string | string[] | undefined) {
  if (Array.isArray(answer)) {
    return answer.length > 0;
  }

  return typeof answer === "string" && answer.trim().length > 0;
}

function aggregateQuestionSummaries(
  blocks: SerializedBlock[],
  responses: StoredResponseLike[],
): QuestionSummary[] {
  const answerableBlocks = blocks.filter((block) =>
    isQuestionBlock(block.type),
  );
  const responseSummaries = responses.map((response, index) => ({
    id: response.id,
    submissionNumber: index + 1,
    answers: parseStoredAnswers(response.answersJson),
    visitedBlockIds: getVisitedBlockIds(response.formSnapshotJson, blocks),
  }));

  return answerableBlocks.map((block) => {
    const reachedResponses = responseSummaries.filter((response) =>
      response.visitedBlockIds.has(block.id),
    );
    const skippedCount = responseSummaries.length - reachedResponses.length;

    // Every answered instance of a repeating block counts like a separate
    // answer in the tallies, while reached, answered and empty stay per
    // response so the four counts keep their meaning.
    const answeredEntries = reachedResponses
      .map((response) => ({
        response,
        view: resolveStoredAnswerView(block, response.answers[block.id]),
      }))
      .filter(({ view }) =>
        view.kind === "instances"
          ? view.entries.length > 0
          : hasRecordedAnswer(view.value),
      );
    const answeredCount = answeredEntries.length;
    const emptyCount = reachedResponses.length - answeredCount;

    // What one answered response contributes to the tallies: the answered
    // instances of a repeating block, its flat answer otherwise.
    const answeredValues: AnswerValue[][] = answeredEntries.map(({ view }) =>
      view.kind === "instances"
        ? view.entries.map((entry) => entry.value)
        : Array.isArray(view.value)
          ? view.value
          : typeof view.value === "string"
            ? [view.value]
            : [],
    );

    if (
      block.type === "SINGLE_CHOICE" ||
      block.type === "MULTIPLE_CHOICE" ||
      block.type === "AGREEMENT"
    ) {
      const initialOptions =
        block.type === "AGREEMENT"
          ? [AGREEMENT_ANSWER_VALUES.AGREED, AGREEMENT_ANSWER_VALUES.NOT_AGREED]
          : [...(block.config as ChoiceBlockConfig).options];
      const optionCounts = new Map(initialOptions.map((value) => [value, 0]));

      for (const values of answeredValues) {
        for (const value of values) {
          const selections = Array.isArray(value) ? value : [value];

          for (const selection of selections) {
            optionCounts.set(selection, (optionCounts.get(selection) ?? 0) + 1);
          }
        }
      }

      return {
        block,
        kind: "choice",
        reachedCount: reachedResponses.length,
        answeredCount,
        emptyCount,
        skippedCount,
        optionCounts: [...optionCounts.entries()].map(([value, count]) => ({
          value,
          count,
        })),
      } satisfies QuestionSummary;
    }

    if (isNumericAnswerBlock(block.type)) {
      const numericAnswers = answeredValues
        .flat()
        .filter((value): value is string => typeof value === "string")
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      const average = numericAnswers.length
        ? numericAnswers.reduce((sum, value) => sum + value, 0) /
          numericAnswers.length
        : null;
      const distribution =
        block.type === "RATING"
          ? getRatingValues(block.config as RatingBlockConfig).map((value) => ({
              value: String(value),
              count: numericAnswers.filter((answer) => answer === value).length,
            }))
          : undefined;

      return {
        block,
        kind: "number",
        reachedCount: reachedResponses.length,
        answeredCount,
        emptyCount,
        skippedCount,
        min: numericAnswers.length ? Math.min(...numericAnswers) : null,
        max: numericAnswers.length ? Math.max(...numericAnswers) : null,
        average,
        distribution,
      } satisfies QuestionSummary;
    }

    const answers = answeredEntries
      .flatMap(({ response }, index) =>
        answeredValues[index].flatMap((value): QuestionSummaryAnswer[] =>
          Array.isArray(value)
            ? value.map((entry) => ({
                responseId: response.id,
                submissionNumber: response.submissionNumber,
                value: entry,
              }))
            : [
                {
                  responseId: response.id,
                  submissionNumber: response.submissionNumber,
                  value,
                },
              ],
        ),
      )
      .reverse();

    return {
      block,
      kind: "freeform",
      reachedCount: reachedResponses.length,
      answeredCount,
      emptyCount,
      skippedCount,
      answers,
    } satisfies QuestionSummary;
  });
}

export function buildResponseListItems(
  responses: StoredResponseLike[],
  form: { id: string; blocks: SerializedBlock[] },
): ResponseListItem[] {
  return responses
    .map((response, index) => {
      const answers = parseStoredAnswers(response.answersJson);

      return {
        id: response.id,
        submittedAt: response.submittedAt.toISOString(),
        answerCount: Object.keys(answers).length,
        submissionNumber: index + 1,
        identity: collectResponseIdentity(form.blocks, answers),
      };
    })
    .reverse();
}

export function buildResponseReviewData(input: {
  form: ResponseReviewFormSummary & { blocks: SerializedBlock[] };
  responses: StoredResponseLike[];
}): ResponseReviewData {
  const { form, responses } = input;

  return {
    form: {
      id: form.id,
      title: form.title,
      slug: form.slug,
      status: form.status,
      workspace: form.workspace,
    },
    responses: buildResponseListItems(responses, form),
    questionSummaries: aggregateQuestionSummaries(form.blocks, responses),
  };
}

export function buildResponseDetailData(input: {
  responseId: string;
  formId: string;
  submittedAt: Date;
  submissionNumber: number;
  formTitle: string;
  workspace: WorkspaceReference;
  answersJson: unknown;
  formSnapshotJson: unknown;
  currentBlocks: SerializedBlock[];
  uploads?: ResponseDetailUpload[];
}): ResponseDetail {
  const visitedBlocks = restoreVisitedBlocksFromSnapshot(
    input.formSnapshotJson,
    input.currentBlocks,
    input.formId,
    input.submittedAt,
  );
  const answers = parseStoredAnswers(input.answersJson);

  return {
    id: input.responseId,
    submittedAt: input.submittedAt.toISOString(),
    submissionNumber: input.submissionNumber,
    formTitle: input.formTitle,
    workspace: input.workspace,
    identity: collectResponseIdentity(input.currentBlocks, answers),
    answers,
    uploads: Object.fromEntries(
      (input.uploads ?? []).map((upload) => [upload.id, upload]),
    ),
    blocks: visitedBlocks,
  };
}
