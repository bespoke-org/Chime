import type { FormBlockType as PrismaFormBlockType } from "@prisma/client";

import {
  AGREEMENT_ANSWER_VALUES,
  getVisibleBranchOperators,
  isChoiceBlock,
  isQuestionBlock,
  type BlockConfig,
  type BranchOperator,
  type BranchRule,
} from "@/lib/blocks";
import { normalizeBlockConfig } from "@/lib/block-config-normalization";
import type { BuilderBlock } from "@/lib/form-types";

export type ChoiceOptionDraft = {
  id: string;
  value: string;
};

export type BranchRuleDraft = {
  id: string;
  operator: BranchOperator;
  value: string | null;
  targetBlockId: string;
};

export function createChoiceOptionDraft(value: string): ChoiceOptionDraft {
  return {
    id: crypto.randomUUID(),
    value,
  };
}

export function createChoiceOptionDrafts(
  options: string[],
): ChoiceOptionDraft[] {
  return options.map((value) => createChoiceOptionDraft(value));
}

export function serializeChoiceOptionDrafts(drafts: ChoiceOptionDraft[]) {
  return drafts.map((option) => option.value);
}

export function createBranchRuleDraft(rule: BranchRule): BranchRuleDraft {
  return {
    id: crypto.randomUUID(),
    ...rule,
  };
}

export function createBranchRuleDrafts(rules: BranchRule[]): BranchRuleDraft[] {
  return rules.map((rule) => createBranchRuleDraft(rule));
}

export function serializeBranchRuleDrafts(
  drafts: BranchRuleDraft[],
): BranchRule[] {
  return drafts.map((rule) => ({
    operator: rule.operator,
    value: rule.value,
    targetBlockId: rule.targetBlockId,
  }));
}

export function createDefaultBranchRuleDraft(args: {
  blockType: PrismaFormBlockType;
  targetBlockId: string;
}): BranchRuleDraft {
  const { blockType, targetBlockId } = args;

  return createBranchRuleDraft({
    operator: getVisibleBranchOperators(blockType)[0] ?? "equals",
    value: blockType === "AGREEMENT" ? AGREEMENT_ANSWER_VALUES.AGREED : null,
    targetBlockId,
  });
}

type ComparableBuilderBlockDraft = Pick<
  BuilderBlock,
  "id" | "type" | "title" | "description" | "required"
> & {
  config: BlockConfig;
};

function createComparableBuilderBlock(
  block: BuilderBlock,
): ComparableBuilderBlockDraft {
  return {
    id: block.id,
    type: block.type,
    title: block.title,
    description: block.description,
    required: block.required,
    config: normalizeBlockConfig(block.type, block.config),
  };
}

export function normalizeBuilderBlockDraft(args: {
  blockDraft: BuilderBlock;
  choiceOptionsDraft: ChoiceOptionDraft[];
  branchRulesDraft: BranchRuleDraft[];
}): ComparableBuilderBlockDraft {
  const { blockDraft, choiceOptionsDraft, branchRulesDraft } = args;
  const config = {
    ...(blockDraft.config as Record<string, unknown>),
  };

  if (isChoiceBlock(blockDraft.type)) {
    config.options = serializeChoiceOptionDrafts(choiceOptionsDraft);
  }

  if (isQuestionBlock(blockDraft.type)) {
    config.branchRules = serializeBranchRuleDrafts(branchRulesDraft);
  }

  return createComparableBuilderBlock({
    ...blockDraft,
    config: normalizeBlockConfig(blockDraft.type, config),
  });
}

export function hasBuilderBlockDraftChanges(args: {
  savedBlock: BuilderBlock | null;
  blockDraft: BuilderBlock | null;
  choiceOptionsDraft: ChoiceOptionDraft[];
  branchRulesDraft: BranchRuleDraft[];
}) {
  const { savedBlock, blockDraft, choiceOptionsDraft, branchRulesDraft } = args;

  if (!savedBlock || !blockDraft || savedBlock.id !== blockDraft.id) {
    return false;
  }

  return (
    JSON.stringify(createComparableBuilderBlock(savedBlock)) !==
    JSON.stringify(
      normalizeBuilderBlockDraft({
        blockDraft,
        choiceOptionsDraft,
        branchRulesDraft,
      }),
    )
  );
}

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

// <input type="datetime-local"> works in the creator's local time without a
// zone, so the stored UTC instant is rendered and read back through Date.
export function toDateTimeLocalValue(iso: string | null) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}T${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function parseMaxResponsesDraft(value: string) {
  const trimmed = value.trim();

  return trimmed === "" ? null : Number(trimmed);
}
