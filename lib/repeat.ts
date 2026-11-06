import { validateAndNormalizeAnswer } from "@/lib/answer-validation";
import type { AnswerValidationError } from "@/lib/answer-validation";
import { parseNumericAnswer, type SerializedBlock } from "@/lib/blocks";
import type { AnswerValue } from "@/lib/form-types";
import type { PageRepeatSettings, ResolvedPage } from "@/lib/pages";
import { findPageByBlock } from "@/lib/pages";

// The hard limit on how many instances a repeating page unfolds into, applied
// by the runner and the server alike. A tighter range is the count block's own
// min/max configuration.
export const MAX_PAGE_INSTANCES = 50;

export type InstanceCountResult =
  | { status: "count"; count: number }
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "too_large"; max: number };

// Reads the count block's stored answer. The count block sits on an earlier
// non-repeating page, so its own answer is always flat.
export function resolveInstanceCount(
  rawCount: AnswerValue | undefined,
): InstanceCountResult {
  if (rawCount === undefined || rawCount === null) {
    return { status: "missing" };
  }

  const raw = Array.isArray(rawCount) ? null : rawCount.trim();
  if (!raw) {
    return { status: "missing" };
  }

  const value = parseNumericAnswer(raw);

  if (value === null || !Number.isInteger(value) || value < 0) {
    return { status: "invalid" };
  }

  if (value > MAX_PAGE_INSTANCES) {
    return { status: "too_large", max: MAX_PAGE_INSTANCES };
  }

  return { status: "count", count: value };
}

// The settings only take effect when they resolve: the count block exists, is
// a number block, sits on an earlier page and its own page does not repeat.
// Anything else degrades the page to a single instance at runtime; the builder
// reports the details through validateRepeatSettings.
export function effectiveRepeatSettings(
  page: ResolvedPage,
  pages: ResolvedPage[],
): PageRepeatSettings | null {
  const settings = page.definition?.repeat;
  if (!settings) {
    return null;
  }

  const countPage = findPageByBlock(pages, settings.countBlockId);
  if (!countPage) {
    return null;
  }

  const countBlock = countPage.blocks.find(
    (block) => block.id === settings.countBlockId,
  );
  if (!countBlock || countBlock.type !== "NUMBER") {
    return null;
  }

  if (pages.indexOf(countPage) >= pages.indexOf(page)) {
    return null;
  }

  if (countPage.definition?.repeat) {
    return null;
  }

  return settings;
}

export type RepeatValidationIssueCode =
  | "repeat_count_block_missing"
  | "repeat_count_block_not_number"
  | "repeat_count_block_on_page"
  | "repeat_count_block_after_page"
  | "repeat_count_block_repeats";

export type RepeatValidationIssue = {
  code: RepeatValidationIssueCode;
  pageId: string;
  countBlockId: string;
};

// Granular warnings for the builder, one per page whose stored repeat
// settings do not resolve. They never block saving.
export function validateRepeatSettings(
  pages: ResolvedPage[],
): RepeatValidationIssue[] {
  const issues: RepeatValidationIssue[] = [];

  for (const page of pages) {
    const settings = page.definition?.repeat;
    if (!settings) {
      continue;
    }

    const issue = (code: RepeatValidationIssueCode): RepeatValidationIssue => ({
      code,
      pageId: page.id,
      countBlockId: settings.countBlockId,
    });

    const countPage = findPageByBlock(pages, settings.countBlockId);
    if (!countPage) {
      issues.push(issue("repeat_count_block_missing"));
      continue;
    }

    if (countPage.id === page.id) {
      issues.push(issue("repeat_count_block_on_page"));
      continue;
    }

    if (pages.indexOf(countPage) >= pages.indexOf(page)) {
      issues.push(issue("repeat_count_block_after_page"));
      continue;
    }

    if (countPage.definition?.repeat) {
      issues.push(issue("repeat_count_block_repeats"));
      continue;
    }

    const countBlock = countPage.blocks.find(
      (block) => block.id === settings.countBlockId,
    );
    if (!countBlock || countBlock.type !== "NUMBER") {
      issues.push(issue("repeat_count_block_not_number"));
    }
  }

  return issues;
}

// A stored answer of a block on a repeating page: one entry per instance.
// Scalar blocks store string[]; multiple choice stores string[][], the inner
// array being the selections of one instance.
export type RepeatingAnswer = string[] | string[][];

export type RepeatingAnswerValidation =
  | { ok: true; values: Array<AnswerValue | undefined> }
  | { ok: false; instanceIndex: number; error: AnswerValidationError };

// Validates every instance of a repeating block with the block's own
// validation and returns the per-instance values, trimmed of trailing
// unanswered instances (the storage shape). Instances beyond the current
// count that the respondent filled earlier are ignored.
export function validateAndNormalizeRepeatingAnswer(
  block: SerializedBlock,
  rawValue: unknown,
  instanceCount: number,
): RepeatingAnswerValidation {
  const instances = Array.isArray(rawValue) ? rawValue : [];
  const values: Array<AnswerValue | undefined> = [];

  for (let index = 0; index < instanceCount; index += 1) {
    const result = validateAndNormalizeAnswer(block, instances[index]);

    if (!result.ok) {
      return { ok: false, instanceIndex: index, error: result.error };
    }

    values.push(result.value);
  }

  while (values.length && values[values.length - 1] === undefined) {
    values.pop();
  }

  return { ok: true, values };
}

// Whether a stored value is the per-instance nested shape of a repeating
// block, as opposed to the block's flat shape (a page whose repeat settings
// degraded keeps saving flat answers). Multiple choice stores string[][] when
// nested and string[] when flat, so its check looks one level deeper.
export function isNestedRepeatingAnswer(
  block: SerializedBlock,
  value: unknown,
): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  if (block.type === "MULTIPLE_CHOICE") {
    return value.every((item) => Array.isArray(item));
  }

  return true;
}

// A flat single-instance view of the answers: nested values of repeating
// blocks collapse to the given instance, flat values pass through. Used for
// branch rule evaluation, identity collection and anything that expects the
// pre-repeating answer shape. One index applies to every repeating page; the
// exit rules of a page pass the page's last instance index.
export function projectInstanceAnswers(
  answers: Record<string, unknown>,
  pages: ResolvedPage[],
  instanceIndex: number,
): Record<string, AnswerValue> {
  const repeatingBlocks = new Map<string, SerializedBlock>();

  for (const page of pages) {
    if (!page.definition?.repeat) {
      continue;
    }

    for (const block of page.blocks) {
      repeatingBlocks.set(block.id, block);
    }
  }

  const projected: Record<string, AnswerValue> = {};

  for (const [blockId, value] of Object.entries(answers)) {
    const block = repeatingBlocks.get(blockId);

    if (!block || !isNestedRepeatingAnswer(block, value)) {
      projected[blockId] = value as AnswerValue;
      continue;
    }

    const instances = value as unknown[];
    const instance = instances[instanceIndex];
    if (instance !== undefined && instance !== null) {
      projected[blockId] = instance as AnswerValue;
    }
  }

  return projected;
}

// One entry per answered instance of a stored repeating answer, for review
// and export. Holes left by unanswered instances (null entries) and empty
// selections are dropped, but the original instance numbers survive, so
// labels stay truthful when a middle instance is unanswered.
export type InstanceAnswerEntry = {
  value: AnswerValue;
  instanceIndex: number;
};

export function instanceAnswerEntries(value: unknown): InstanceAnswerEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: InstanceAnswerEntry[] = [];

  value.forEach((instance, instanceIndex) => {
    if (
      (typeof instance === "string" && instance !== "") ||
      (Array.isArray(instance) &&
        instance.length > 0 &&
        instance.every((item) => typeof item === "string"))
    ) {
      entries.push({ value: instance, instanceIndex });
    }
  });

  return entries;
}
