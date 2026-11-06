import type { FormBlockType as PrismaFormBlockType } from "@prisma/client";
import { z } from "zod";

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
import { parsePageRegistry, type PageDefinition } from "@/lib/pages";

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

  try {
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
  } catch {
    // A half-typed regex or webhook key fails the schema; it is still an
    // unsaved change, and saving reports the error.
    return true;
  }
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

export const FORM_BUILDER_DRAFT_STORAGE_PREFIX = "chime-builder-draft";
export const FORM_BUILDER_DRAFT_VERSION = 1;

// A block as the builder edits it: the serialized block plus the page it
// belongs to. pageId is absent while the block payload predates pages.
export type BuilderDraftBlock = BuilderBlock & { pageId?: string | null };

// The builder draft kept in localStorage. pages is absent in drafts saved
// before pages existed; loading treats it as "no pages saved" and the blocks
// resolve to single-block pages.
export type StoredFormBuilderDraft = {
  version: typeof FORM_BUILDER_DRAFT_VERSION;
  formId: string;
  savedAt: number;
  blocks: BuilderDraftBlock[];
  pages?: PageDefinition[];
};

export type StoredFormBuilderDraftReadResult =
  | {
      status: "missing" | "unavailable" | "invalid";
    }
  | {
      status: "ok";
      draft: StoredFormBuilderDraft;
    };

const storedFormBuilderDraftSchema = z.object({
  version: z.literal(FORM_BUILDER_DRAFT_VERSION),
  formId: z.string().min(1),
  savedAt: z.number().int().nonnegative(),
  // Only the envelope is checked: a stored block keeps whatever shape the
  // builder saved (dates come back as ISO strings).
  blocks: z.array(z.record(z.string(), z.unknown())),
  pages: z.array(z.unknown()).optional(),
});

export function getFormBuilderDraftStorageKey(formId: string) {
  return `${FORM_BUILDER_DRAFT_STORAGE_PREFIX}:${formId}`;
}

export function createFormBuilderDraft(args: {
  formId: string;
  blocks: BuilderDraftBlock[];
  pages?: PageDefinition[];
}): StoredFormBuilderDraft {
  return {
    version: FORM_BUILDER_DRAFT_VERSION,
    formId: args.formId,
    savedAt: Date.now(),
    blocks: args.blocks,
    ...(args.pages === undefined ? {} : { pages: args.pages }),
  };
}

export function parseFormBuilderDraft(
  value: unknown,
): StoredFormBuilderDraft | null {
  const parsed = storedFormBuilderDraftSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return {
    version: parsed.data.version,
    formId: parsed.data.formId,
    savedAt: parsed.data.savedAt,
    blocks: parsed.data.blocks as BuilderDraftBlock[],
    ...(parsed.data.pages === undefined
      ? {}
      : { pages: parsePageRegistry(parsed.data.pages) }),
  };
}

export function readStoredFormBuilderDraft(
  storageKey: string,
): StoredFormBuilderDraftReadResult {
  let rawDraft: string | null = null;

  try {
    rawDraft = window.localStorage.getItem(storageKey);
  } catch {
    return { status: "unavailable" };
  }

  if (!rawDraft) {
    return { status: "missing" };
  }

  try {
    const draft = parseFormBuilderDraft(JSON.parse(rawDraft));
    return draft ? { status: "ok", draft } : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

export function writeStoredFormBuilderDraft(
  storageKey: string,
  draft: StoredFormBuilderDraft,
) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // ignore persistence failures
  }
}

export function removeStoredFormBuilderDraft(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore persistence failures
  }
}
