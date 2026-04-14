import type { FormBlockType as PrismaFormBlockType } from "@prisma/client";

import {
  AGREEMENT_ANSWER_VALUES,
  getVisibleBranchOperators,
  type BranchOperator,
  type BranchRule,
} from "@/lib/blocks";

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
