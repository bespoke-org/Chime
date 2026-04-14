import {
  AGREEMENT_ANSWER_VALUES,
  isAgreementAnswerValue,
  isQuestionBlock,
  isTextAnswerBlock,
  isValidDateAnswer,
  isValidLinkAnswer,
  parseNumericAnswer,
  type ChoiceBlockConfig,
  type NumberBlockConfig,
  type SerializedBlock,
  type TextAnswerBlockConfig,
} from "@/lib/blocks";
import type { AnswerValue } from "@/lib/form-types";

export type AnswerValidationError =
  | {
      code: "answer_required";
    }
  | {
      code: "single_choice_required";
    }
  | {
      code: "multi_choice_required";
    }
  | {
      code: "agreement_required";
    }
  | {
      code: "invalid_text_format";
    }
  | {
      code: "invalid_option";
    }
  | {
      code: "invalid_number";
    }
  | {
      code: "whole_number_required";
    }
  | {
      code: "number_below_min";
      min: number;
    }
  | {
      code: "number_above_max";
      max: number;
    }
  | {
      code: "invalid_link";
    }
  | {
      code: "invalid_date";
    }
  | {
      code: "invalid_agreement";
    };

export type AnswerValidationResult =
  | {
      ok: true;
      value: AnswerValue | undefined;
    }
  | {
      ok: false;
      error: AnswerValidationError;
    };

export function validateAndNormalizeAnswer(
  block: SerializedBlock,
  rawValue: unknown,
): AnswerValidationResult {
  if (!isQuestionBlock(block.type)) {
    return { ok: true, value: undefined };
  }

  if (isTextAnswerBlock(block.type)) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    const validationRegex = (block.config as TextAnswerBlockConfig)
      .validationRegex;

    if (!value) {
      return block.required
        ? { ok: false, error: { code: "answer_required" } }
        : { ok: true, value: undefined };
    }

    if (validationRegex && !new RegExp(validationRegex).test(value)) {
      return { ok: false, error: { code: "invalid_text_format" } };
    }

    return { ok: true, value };
  }

  if (block.type === "SINGLE_CHOICE") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    const options = (block.config as ChoiceBlockConfig).options;

    if (!value) {
      return block.required
        ? { ok: false, error: { code: "single_choice_required" } }
        : { ok: true, value: undefined };
    }

    if (!options.includes(value)) {
      return { ok: false, error: { code: "invalid_option" } };
    }

    return { ok: true, value };
  }

  if (block.type === "MULTIPLE_CHOICE") {
    const values = Array.isArray(rawValue)
      ? rawValue.filter((value): value is string => typeof value === "string")
      : [];
    const options = (block.config as ChoiceBlockConfig).options;
    const uniqueValues = [
      ...new Set(values.map((value) => value.trim()).filter(Boolean)),
    ];

    if (!uniqueValues.length) {
      return block.required
        ? { ok: false, error: { code: "multi_choice_required" } }
        : { ok: true, value: undefined };
    }

    if (!uniqueValues.every((value) => options.includes(value))) {
      return { ok: false, error: { code: "invalid_option" } };
    }

    return { ok: true, value: uniqueValues };
  }

  if (block.type === "NUMBER") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    const config = block.config as NumberBlockConfig;

    if (!value) {
      return block.required
        ? { ok: false, error: { code: "answer_required" } }
        : { ok: true, value: undefined };
    }

    const numericValue = parseNumericAnswer(value);

    if (numericValue === null) {
      return { ok: false, error: { code: "invalid_number" } };
    }

    if (!config.allowFloat && !Number.isInteger(numericValue)) {
      return { ok: false, error: { code: "whole_number_required" } };
    }

    if (config.min !== null && numericValue < config.min) {
      return {
        ok: false,
        error: {
          code: "number_below_min",
          min: config.min,
        },
      };
    }

    if (config.max !== null && numericValue > config.max) {
      return {
        ok: false,
        error: {
          code: "number_above_max",
          max: config.max,
        },
      };
    }

    return { ok: true, value: String(numericValue) };
  }

  if (block.type === "LINK") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      return block.required
        ? { ok: false, error: { code: "answer_required" } }
        : { ok: true, value: undefined };
    }

    if (!isValidLinkAnswer(value)) {
      return { ok: false, error: { code: "invalid_link" } };
    }

    return { ok: true, value: new URL(value).toString() };
  }

  if (block.type === "DATE") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      return block.required
        ? { ok: false, error: { code: "answer_required" } }
        : { ok: true, value: undefined };
    }

    if (!isValidDateAnswer(value)) {
      return { ok: false, error: { code: "invalid_date" } };
    }

    return { ok: true, value };
  }

  if (block.type === "AGREEMENT") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      return block.required
        ? { ok: false, error: { code: "agreement_required" } }
        : { ok: true, value: undefined };
    }

    if (!isAgreementAnswerValue(value)) {
      return { ok: false, error: { code: "invalid_agreement" } };
    }

    if (block.required && value !== AGREEMENT_ANSWER_VALUES.AGREED) {
      return { ok: false, error: { code: "agreement_required" } };
    }

    return { ok: true, value };
  }

  return { ok: true, value: undefined };
}
