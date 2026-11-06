import { z } from "zod";

import {
  validateAndNormalizeAnswer,
  type AnswerValidationError,
} from "@/lib/answer-validation";
import type { SerializedBlock } from "@/lib/blocks";
import { resolveNextPageId } from "@/lib/branching";
import { AppError } from "@/lib/errors";
import type { AnswerValue, StoredAnswerValue } from "@/lib/form-types";
import { resolvePages, type ResolvedPage } from "@/lib/pages";
import {
  effectiveRepeatSettings,
  projectInstanceAnswers,
  resolveInstanceCount,
  validateAndNormalizeRepeatingAnswer,
} from "@/lib/repeat";

export type SubmissionAnswers = Record<string, StoredAnswerValue>;

export type SubmissionSnapshotBlock = Pick<
  SerializedBlock,
  "id" | "type" | "title" | "description" | "required" | "position" | "config"
>;

export type Submission = {
  normalizedAnswers: SubmissionAnswers;
  snapshot: SubmissionSnapshotBlock[];
};

// An unanswered instance inside a repeating answer serializes as null: the
// client trims only trailing unanswered instances, so a middle one reaches
// the server as a null entry of the instance array. Null is valid nowhere
// else; the walk treats it like any other unanswered value.
const submissionAnswersSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.array(z.union([z.string(), z.null()])),
    z.array(z.union([z.array(z.string()), z.null()])),
  ]),
);

export function parseSubmissionPayload(payload: unknown): SubmissionAnswers {
  const parsed = submissionAnswersSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Invalid response payload.", 422);
  }

  return parsed.data as SubmissionAnswers;
}

function getQuestionLabel(block: SerializedBlock) {
  return block.title || "this question";
}

function answerErrorMessage(
  block: SerializedBlock,
  error: AnswerValidationError,
) {
  const questionLabel = getQuestionLabel(block);

  switch (error.code) {
    case "answer_required":
      if (block.type === "NUMBER") {
        return `Please enter a number for “${questionLabel}”.`;
      }

      if (block.type === "RATING") {
        return `Please choose a rating for “${questionLabel}”.`;
      }

      if (block.type === "LINK") {
        return `Please enter a link for “${questionLabel}”.`;
      }

      if (block.type === "FILE_UPLOAD") {
        return `Please attach a file for “${questionLabel}”.`;
      }

      if (block.type === "DATE") {
        return `Please enter a date for “${questionLabel}”.`;
      }

      return `Please answer “${questionLabel}”.`;
    case "single_choice_required":
      return `Please choose an option for “${questionLabel}”.`;
    case "multi_choice_required":
      return `Please choose at least one option for “${questionLabel}”.`;
    case "agreement_required":
      return `Agreement is required for “${questionLabel}”.`;
    case "invalid_text_format":
      return `Please use a valid format for “${questionLabel}”.`;
    case "invalid_option":
      return `Invalid option submitted for “${questionLabel}”.`;
    case "invalid_number":
      return `Please enter a valid number for “${questionLabel}”.`;
    case "whole_number_required":
      return `Please enter a whole number for “${questionLabel}”.`;
    case "number_below_min":
      return `Please enter a number greater than or equal to ${error.min} for “${questionLabel}”.`;
    case "number_above_max":
      return `Please enter a number less than or equal to ${error.max} for “${questionLabel}”.`;
    case "invalid_link":
      return `Please enter a valid link for “${questionLabel}”.`;
    case "invalid_date":
      return `Please enter a valid date for “${questionLabel}”.`;
    case "invalid_agreement":
      return `Invalid agreement value submitted for “${questionLabel}”.`;
    case "invalid_file":
      return `The uploaded file could not be verified for “${questionLabel}”.`;
  }
}

function normalizeAnswer(
  block: SerializedBlock,
  rawValue: unknown,
): AnswerValue | undefined {
  const result = validateAndNormalizeAnswer(block, rawValue);

  if (result.ok) {
    return result.value;
  }

  throw new AppError(answerErrorMessage(block, result.error), 422);
}

// The instance count of a repeating page, from the count block's normalized
// answer. The count block sits on an earlier page the walk has already
// processed, and that page never repeats, so the answer is flat.
function pageInstanceCount(
  countBlock: SerializedBlock,
  normalizedAnswers: SubmissionAnswers,
) {
  const result = resolveInstanceCount(
    normalizedAnswers[countBlock.id] as AnswerValue | undefined,
  );

  if (result.status === "count") {
    return result.count;
  }

  const questionLabel = getQuestionLabel(countBlock);

  if (result.status === "too_large") {
    throw new AppError(
      `Please enter a number less than or equal to ${result.max} for “${questionLabel}”.`,
      422,
    );
  }

  throw new AppError(`Please answer “${questionLabel}”.`, 422);
}

function toSnapshotBlock(block: SerializedBlock): SubmissionSnapshotBlock {
  return {
    id: block.id,
    type: block.type,
    title: block.title,
    description: block.description,
    required: block.required,
    position: block.position,
    config: block.config,
  };
}

// The walk mirrors the runner page by page: every block of a page is
// normalized in page order, and only the page's last block decides where the
// form goes next, so rules on earlier blocks of a page never run here.
export function buildSubmission(
  blocks: SerializedBlock[],
  answersInput: SubmissionAnswers,
  pagesJson?: unknown,
): Submission {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const pages = resolvePages(blocks, pagesJson);
  const normalizedAnswers: SubmissionAnswers = {};
  const snapshot: SubmissionSnapshotBlock[] = [];

  let currentPage: ResolvedPage | undefined = pages[0];
  let safetyCounter = 0;

  while (currentPage && safetyCounter < pages.length + 1) {
    const repeatSettings = effectiveRepeatSettings(currentPage, pages);
    const countBlock = repeatSettings
      ? (blocksById.get(repeatSettings.countBlockId) ?? null)
      : null;
    let ranInstanceCount = 0;

    if (repeatSettings && countBlock) {
      const instanceCount = pageInstanceCount(countBlock, normalizedAnswers);

      if (instanceCount > 0) {
        ranInstanceCount = instanceCount;

        for (const block of currentPage.blocks) {
          snapshot.push(toSnapshotBlock(block));

          const result = validateAndNormalizeRepeatingAnswer(
            block,
            answersInput[block.id],
            instanceCount,
          );

          if (!result.ok) {
            throw new AppError(
              `${answerErrorMessage(block, result.error)} for instance ${result.instanceIndex + 1}`,
              422,
            );
          }

          if (result.values.length) {
            // An unanswered instance inside the array stays undefined here
            // and serializes as null in answersJson.
            normalizedAnswers[block.id] = result.values as StoredAnswerValue;
          }
        }
      }
    } else {
      for (const block of currentPage.blocks) {
        snapshot.push(toSnapshotBlock(block));

        const answer = normalizeAnswer(block, answersInput[block.id]);

        if (typeof answer !== "undefined") {
          normalizedAnswers[block.id] = answer;
        }
      }
    }

    const nextPageId = resolveNextPageId(
      pages,
      currentPage.id,
      projectInstanceAnswers(
        normalizedAnswers,
        pages,
        ranInstanceCount > 0 ? ranInstanceCount - 1 : 0,
      ),
    );
    currentPage = nextPageId
      ? (pages.find((page) => page.id === nextPageId) ?? undefined)
      : undefined;
    safetyCounter += 1;
  }

  return { normalizedAnswers, snapshot };
}

export function assertReorderMatchesForm(
  currentIds: string[],
  nextIds: string[],
) {
  const sortedCurrent = [...currentIds].sort();
  const sortedNext = [...nextIds].sort();

  if (
    sortedCurrent.length !== sortedNext.length ||
    sortedCurrent.some((id, index) => id !== sortedNext[index])
  ) {
    throw new AppError(
      "Block reorder payload is out of sync with the current form.",
      409,
    );
  }
}
