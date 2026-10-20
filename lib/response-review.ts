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
import { collectResponseIdentity } from "@/lib/response-identity";
import type {
  QuestionSummary,
  QuestionSummaryAnswer,
  ResponseDetail,
  ResponseDetailUpload,
  ResponseListItem,
  ResponseReviewData,
  ResponseReviewFormSummary,
  WorkspaceReference,
} from "@/lib/form-types";

type StoredAnswerValue = string | string[];

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
    const answeredResponses = reachedResponses.filter((response) =>
      hasRecordedAnswer(response.answers[block.id]),
    );
    const answeredCount = answeredResponses.length;
    const emptyCount = reachedResponses.length - answeredCount;

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

      for (const response of answeredResponses) {
        const answer = response.answers[block.id];
        const values = Array.isArray(answer)
          ? answer
          : typeof answer === "string"
            ? [answer]
            : [];

        for (const value of values) {
          optionCounts.set(value, (optionCounts.get(value) ?? 0) + 1);
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
      const numericAnswers = answeredResponses
        .map((response) => response.answers[block.id])
        .filter((answer): answer is string => typeof answer === "string")
        .map((answer) => Number(answer))
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

    const answers = answeredResponses
      .map((response) => ({
        responseId: response.id,
        submissionNumber: response.submissionNumber,
        value: response.answers[block.id],
      }))
      .flatMap((response): QuestionSummaryAnswer[] => {
        if (Array.isArray(response.value)) {
          return response.value.map((value) => ({
            responseId: response.responseId,
            submissionNumber: response.submissionNumber,
            value,
          }));
        }

        if (typeof response.value === "string") {
          return [
            {
              responseId: response.responseId,
              submissionNumber: response.submissionNumber,
              value: response.value,
            },
          ];
        }

        return [];
      })
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
