import { z } from "zod";

import { validateAndNormalizeAnswer } from "@/lib/answer-validation";
import type { SerializedBlock } from "@/lib/blocks";
import { resolveNextBlockId } from "@/lib/branching";
import { AppError } from "@/lib/errors";
import type { AnswerValue } from "@/lib/form-types";

export type SubmissionAnswers = Record<string, AnswerValue>;

export type SubmissionSnapshotBlock = Pick<
  SerializedBlock,
  "id" | "type" | "title" | "description" | "required" | "position" | "config"
>;

export type Submission = {
  normalizedAnswers: SubmissionAnswers;
  snapshot: SubmissionSnapshotBlock[];
};

const submissionAnswersSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

export function parseSubmissionPayload(payload: unknown): SubmissionAnswers {
  const parsed = submissionAnswersSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Invalid response payload.", 422);
  }

  return parsed.data;
}

function getQuestionLabel(block: SerializedBlock) {
  return block.title || "this question";
}

function normalizeAnswer(
  block: SerializedBlock,
  rawValue: unknown,
): AnswerValue | undefined {
  const questionLabel = getQuestionLabel(block);
  const result = validateAndNormalizeAnswer(block, rawValue);

  if (result.ok) {
    return result.value;
  }

  switch (result.error.code) {
    case "answer_required":
      if (block.type === "NUMBER") {
        throw new AppError(
          `Please enter a number for “${questionLabel}”.`,
          422,
        );
      }

      if (block.type === "LINK") {
        throw new AppError(`Please enter a link for “${questionLabel}”.`, 422);
      }

      if (block.type === "DATE") {
        throw new AppError(`Please enter a date for “${questionLabel}”.`, 422);
      }

      throw new AppError(`Please answer “${questionLabel}”.`, 422);
    case "single_choice_required":
      throw new AppError(
        `Please choose an option for “${questionLabel}”.`,
        422,
      );
    case "multi_choice_required":
      throw new AppError(
        `Please choose at least one option for “${questionLabel}”.`,
        422,
      );
    case "agreement_required":
      throw new AppError(`Agreement is required for “${questionLabel}”.`, 422);
    case "invalid_text_format":
      throw new AppError(
        `Please use a valid format for “${questionLabel}”.`,
        422,
      );
    case "invalid_option":
      throw new AppError(
        `Invalid option submitted for “${questionLabel}”.`,
        422,
      );
    case "invalid_number":
      throw new AppError(
        `Please enter a valid number for “${questionLabel}”.`,
        422,
      );
    case "whole_number_required":
      throw new AppError(
        `Please enter a whole number for “${questionLabel}”.`,
        422,
      );
    case "number_below_min":
      throw new AppError(
        `Please enter a number greater than or equal to ${result.error.min} for “${questionLabel}”.`,
        422,
      );
    case "number_above_max":
      throw new AppError(
        `Please enter a number less than or equal to ${result.error.max} for “${questionLabel}”.`,
        422,
      );
    case "invalid_link":
      throw new AppError(
        `Please enter a valid link for “${questionLabel}”.`,
        422,
      );
    case "invalid_date":
      throw new AppError(
        `Please enter a valid date for “${questionLabel}”.`,
        422,
      );
    case "invalid_agreement":
      throw new AppError(
        `Invalid agreement value submitted for “${questionLabel}”.`,
        422,
      );
  }
}

export function buildSubmission(
  blocks: SerializedBlock[],
  answersInput: SubmissionAnswers,
): Submission {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const normalizedAnswers: SubmissionAnswers = {};
  const snapshot: SubmissionSnapshotBlock[] = [];

  let currentBlock: SerializedBlock | undefined = blocks[0];
  let safetyCounter = 0;

  while (currentBlock && safetyCounter < blocks.length) {
    snapshot.push({
      id: currentBlock.id,
      type: currentBlock.type,
      title: currentBlock.title,
      description: currentBlock.description,
      required: currentBlock.required,
      position: currentBlock.position,
      config: currentBlock.config,
    });

    const answer = normalizeAnswer(currentBlock, answersInput[currentBlock.id]);

    if (typeof answer !== "undefined") {
      normalizedAnswers[currentBlock.id] = answer;
    }

    const nextBlockId = resolveNextBlockId(
      blocks,
      currentBlock.id,
      normalizedAnswers,
    );
    currentBlock = nextBlockId ? blocksById.get(nextBlockId) : undefined;
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
