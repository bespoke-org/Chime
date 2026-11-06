import {
  AGREEMENT_ANSWER_VALUES,
  branchOperatorNeedsValue,
  getBranchRules,
  getDefaultNextBlockId,
  getEndForm,
  getSupportedBranchOperators,
  isAgreementAnswerValue,
  isNumericAnswerBlock,
  isQuestionBlock,
  isValidDateAnswer,
  isValidLinkAnswer,
  parseNumericAnswer,
  type AgreementBlockConfig,
  type BranchOperator,
  type BranchRule,
  type ChoiceBlockConfig,
  type RatingBlockConfig,
  type SerializedBlock,
} from "@/lib/blocks";
import { findPageByBlock, resolvePages, type ResolvedPage } from "@/lib/pages";

export type BranchValidationIssueSeverity = "blocker" | "warning";

export type BranchValidationIssueCode =
  | "invalid-target"
  | "backward-target"
  | "invalid-default-target"
  | "backward-default-target"
  | "invalid-condition"
  | "duplicate-condition"
  | "unsupported-operator"
  | "unreachable-block"
  | "fragile-text-match"
  | "overlapping-rule"
  | "partial-choice-coverage"
  | "ignored-page-rules"
  | "ignored-repeat-target";

export type BranchValidationIssue = {
  severity: BranchValidationIssueSeverity;
  code: BranchValidationIssueCode;
  message: string;
  blockId: string;
  ruleIndex?: number;
  targetBlockId?: string;
  value?: string | null;
};

export type BranchValidationIssueI18n = {
  key: string;
  values: Record<string, string | number>;
};

export type BranchValidationAnalysis = {
  blockers: BranchValidationIssue[];
  warnings: BranchValidationIssue[];
};

function compareDateValues(left: string, right: string) {
  return left.localeCompare(right);
}

export function getBlockDisplayLabel(
  block: Pick<SerializedBlock, "position" | "title" | "type">,
) {
  const title = block.title.trim();
  return (
    title ||
    `${isQuestionBlock(block.type) ? "Question" : "Block"} ${block.position + 1}`
  );
}

// Issues whose message lives outside branching.issueMessages. The
// ignored-rules warnings belong to the formPages copy next to the page UI.
const issueMessageKeyOverrides: Partial<
  Record<BranchValidationIssueCode, string>
> = {
  "ignored-page-rules": "formPages.branchRulesIgnored",
  "ignored-repeat-target": "formPages.branchTargetIntoRepeat",
};

export function getBranchValidationIssueI18n(
  issue: BranchValidationIssue,
  blocks: SerializedBlock[],
): BranchValidationIssueI18n {
  const sourceBlock = blocks.find((block) => block.id === issue.blockId);
  const targetBlock = issue.targetBlockId
    ? blocks.find((block) => block.id === issue.targetBlockId)
    : null;
  const blockLabel = sourceBlock
    ? getBlockDisplayLabel(sourceBlock)
    : issue.blockId;
  const targetLabel = targetBlock ? getBlockDisplayLabel(targetBlock) : "";

  return {
    key:
      issueMessageKeyOverrides[issue.code] ??
      `branching.issueMessages.${issue.code}`,
    values: {
      blockLabel,
      targetLabel,
      value: issue.value ?? "",
    },
  };
}

export function normalizeBranchRuleOperand(
  block: SerializedBlock,
  rule: BranchRule,
) {
  if (!branchOperatorNeedsValue(rule.operator)) {
    return null;
  }

  const trimmed = rule.value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (block.type === "SHORT_TEXT" || block.type === "LONG_TEXT") {
    return trimmed;
  }

  if (block.type === "SINGLE_CHOICE" || block.type === "MULTIPLE_CHOICE") {
    const options = (block.config as ChoiceBlockConfig).options;
    return options.includes(trimmed) ? trimmed : null;
  }

  if (isNumericAnswerBlock(block.type)) {
    const parsed = parseNumericAnswer(trimmed);
    return parsed === null ? null : String(parsed);
  }

  if (block.type === "LINK") {
    return isValidLinkAnswer(trimmed) ? new URL(trimmed).toString() : trimmed;
  }

  if (block.type === "DATE") {
    return isValidDateAnswer(trimmed) ? trimmed : null;
  }

  if (block.type === "AGREEMENT") {
    return isAgreementAnswerValue(trimmed) ? trimmed : null;
  }

  return null;
}

function normalizeComparableAnswer(
  block: SerializedBlock,
  answer: string | string[] | undefined,
) {
  if (!isQuestionBlock(block.type)) {
    return undefined;
  }

  if (block.type === "MULTIPLE_CHOICE") {
    if (!Array.isArray(answer)) {
      return undefined;
    }

    const options = (block.config as ChoiceBlockConfig).options;
    const normalized = [
      ...new Set(
        answer
          .map((value) => value.trim())
          .filter((value) => options.includes(value)),
      ),
    ];
    return normalized.length ? normalized : undefined;
  }

  if (typeof answer !== "string") {
    return undefined;
  }

  const trimmed = answer.trim();

  if (!trimmed) {
    return undefined;
  }

  if (block.type === "SHORT_TEXT" || block.type === "LONG_TEXT") {
    return trimmed;
  }

  if (block.type === "SINGLE_CHOICE") {
    return trimmed;
  }

  if (isNumericAnswerBlock(block.type)) {
    const parsed = parseNumericAnswer(trimmed);
    return parsed === null ? undefined : String(parsed);
  }

  if (block.type === "LINK") {
    return isValidLinkAnswer(trimmed) ? new URL(trimmed).toString() : undefined;
  }

  if (block.type === "DATE") {
    return isValidDateAnswer(trimmed) ? trimmed : undefined;
  }

  if (block.type === "AGREEMENT") {
    return isAgreementAnswerValue(trimmed) ? trimmed : undefined;
  }

  return undefined;
}

function isRuleSupportedForBlock(
  block: SerializedBlock,
  operator: BranchOperator,
) {
  return getSupportedBranchOperators(block.type).includes(operator);
}

function isValidForwardTarget(
  blocks: SerializedBlock[],
  sourceIndex: number,
  targetBlockId: string,
) {
  const targetIndex = blocks.findIndex((block) => block.id === targetBlockId);
  return targetIndex > sourceIndex;
}

function compareRuleAgainstAnswer(
  block: SerializedBlock,
  operator: BranchOperator,
  answer: string | string[] | undefined,
  operand: string | null,
) {
  const normalizedAnswer = normalizeComparableAnswer(block, answer);
  const isEmpty =
    typeof normalizedAnswer === "undefined" ||
    (Array.isArray(normalizedAnswer) && normalizedAnswer.length === 0);

  switch (operator) {
    case "is_empty":
      return isEmpty;
    case "is_not_empty":
      return !isEmpty;
    case "equals":
      if (!operand || typeof normalizedAnswer === "undefined") {
        return false;
      }

      return Array.isArray(normalizedAnswer)
        ? normalizedAnswer.includes(operand)
        : normalizedAnswer === operand;
    case "not_equals":
      if (!operand || typeof normalizedAnswer === "undefined") {
        return false;
      }

      return Array.isArray(normalizedAnswer)
        ? !normalizedAnswer.includes(operand)
        : normalizedAnswer !== operand;
    case "contains":
      return typeof normalizedAnswer === "string" && typeof operand === "string"
        ? normalizedAnswer.includes(operand)
        : false;
    case "contains_any":
      return Array.isArray(normalizedAnswer) && typeof operand === "string"
        ? normalizedAnswer.includes(operand)
        : false;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (!operand || typeof normalizedAnswer !== "string") {
        return false;
      }

      if (isNumericAnswerBlock(block.type)) {
        const answerNumber = Number(normalizedAnswer);
        const operandNumber = Number(operand);

        if (!Number.isFinite(answerNumber) || !Number.isFinite(operandNumber)) {
          return false;
        }

        if (operator === "gt") return answerNumber > operandNumber;
        if (operator === "gte") return answerNumber >= operandNumber;
        if (operator === "lt") return answerNumber < operandNumber;
        return answerNumber <= operandNumber;
      }

      if (block.type === "DATE") {
        const comparison = compareDateValues(normalizedAnswer, operand);

        if (operator === "gt") return comparison > 0;
        if (operator === "gte") return comparison >= 0;
        if (operator === "lt") return comparison < 0;
        return comparison <= 0;
      }

      return false;
    }
    default:
      return false;
  }
}

export function branchRuleMatches(
  block: SerializedBlock,
  answer: string | string[] | undefined,
  rule: BranchRule,
) {
  const operand = normalizeBranchRuleOperand(block, rule);
  return compareRuleAgainstAnswer(block, rule.operator, answer, operand);
}

export function resolveNextBlockId(
  blocks: SerializedBlock[],
  currentBlockId: string,
  answers: Record<string, string | string[]>,
) {
  const currentIndex = blocks.findIndex((block) => block.id === currentBlockId);

  if (currentIndex < 0) {
    return null;
  }

  const currentBlock = blocks[currentIndex];
  const linearNextBlockId = blocks[currentIndex + 1]?.id ?? null;

  if (getEndForm(currentBlock.config)) {
    return null;
  }

  if (!isQuestionBlock(currentBlock.type)) {
    return linearNextBlockId;
  }

  for (const rule of getBranchRules(currentBlock.config)) {
    if (!isValidForwardTarget(blocks, currentIndex, rule.targetBlockId)) {
      continue;
    }

    if (!isRuleSupportedForBlock(currentBlock, rule.operator)) {
      continue;
    }

    if (branchRuleMatches(currentBlock, answers[currentBlock.id], rule)) {
      return rule.targetBlockId;
    }
  }

  const configuredDefaultNextBlockId = getDefaultNextBlockId(
    currentBlock.config,
  );

  if (configuredDefaultNextBlockId) {
    return isValidForwardTarget(
      blocks,
      currentIndex,
      configuredDefaultNextBlockId,
    )
      ? configuredDefaultNextBlockId
      : linearNextBlockId;
  }

  return canUseDefaultPath(currentBlock) ? linearNextBlockId : null;
}

function canUseDefaultPath(block: SerializedBlock) {
  if (!isQuestionBlock(block.type)) {
    return true;
  }

  const rules = getBranchRules(block.config);

  if (!rules.length) {
    return true;
  }

  const supportedRules = rules.filter((rule) =>
    isRuleSupportedForBlock(block, rule.operator),
  );

  if (
    supportedRules.some((rule) => rule.operator === "is_empty") &&
    supportedRules.some((rule) => rule.operator === "is_not_empty")
  ) {
    return false;
  }

  if (
    block.type === "SHORT_TEXT" ||
    block.type === "LONG_TEXT" ||
    isNumericAnswerBlock(block.type) ||
    block.type === "LINK" ||
    block.type === "DATE" ||
    block.type === "FILE_UPLOAD"
  ) {
    return !supportedRules.some((rule) => rule.operator === "is_not_empty");
  }

  if (block.type === "SINGLE_CHOICE") {
    const options = (block.config as ChoiceBlockConfig).options;
    const explicitEqualsCoverage = new Set(
      supportedRules
        .filter((rule) => rule.operator === "equals")
        .map((rule) => normalizeBranchRuleOperand(block, rule))
        .filter((value): value is string => Boolean(value)),
    );

    return !block.required || explicitEqualsCoverage.size < options.length;
  }

  if (block.type === "MULTIPLE_CHOICE") {
    return !supportedRules.some((rule) => rule.operator === "is_not_empty");
  }

  if (block.type === "AGREEMENT") {
    const explicitEqualsCoverage = new Set(
      supportedRules
        .filter((rule) => rule.operator === "equals")
        .map((rule) => normalizeBranchRuleOperand(block, rule))
        .filter((value): value is string => Boolean(value)),
    );

    return (
      !block.required ||
      !explicitEqualsCoverage.has(AGREEMENT_ANSWER_VALUES.AGREED)
    );
  }

  return true;
}

export function getPossibleNextBlockIds(
  blocks: SerializedBlock[],
  block: SerializedBlock,
) {
  const blockIndex = blocks.findIndex((candidate) => candidate.id === block.id);

  if (blockIndex < 0) {
    return [];
  }

  const nextIds = new Set<string>();

  if (getEndForm(block.config)) {
    return [...nextIds];
  }

  if (!isQuestionBlock(block.type)) {
    const nextLinearBlockId = blocks[blockIndex + 1]?.id;

    if (nextLinearBlockId) {
      nextIds.add(nextLinearBlockId);
    }

    return [...nextIds];
  }

  for (const rule of getBranchRules(block.config)) {
    if (
      isRuleSupportedForBlock(block, rule.operator) &&
      isValidForwardTarget(blocks, blockIndex, rule.targetBlockId)
    ) {
      nextIds.add(rule.targetBlockId);
    }
  }

  const configuredDefaultNextBlockId = getDefaultNextBlockId(block.config);

  if (configuredDefaultNextBlockId) {
    if (
      isValidForwardTarget(blocks, blockIndex, configuredDefaultNextBlockId)
    ) {
      nextIds.add(configuredDefaultNextBlockId);
    }
  } else if (canUseDefaultPath(block)) {
    const nextLinearBlockId = blocks[blockIndex + 1]?.id;

    if (nextLinearBlockId) {
      nextIds.add(nextLinearBlockId);
    }
  }

  return [...nextIds];
}

function isRuleConditionValid(block: SerializedBlock, rule: BranchRule) {
  if (!isRuleSupportedForBlock(block, rule.operator)) {
    return false;
  }

  if (!branchOperatorNeedsValue(rule.operator)) {
    return true;
  }

  const operand = normalizeBranchRuleOperand(block, rule);

  if (!operand) {
    return false;
  }

  if (
    rule.operator === "contains" &&
    (block.type === "SHORT_TEXT" ||
      block.type === "LONG_TEXT" ||
      block.type === "LINK")
  ) {
    return true;
  }

  if (rule.operator === "contains_any" && block.type === "MULTIPLE_CHOICE") {
    return true;
  }

  if (
    (rule.operator === "gt" ||
      rule.operator === "gte" ||
      rule.operator === "lt" ||
      rule.operator === "lte") &&
    (isNumericAnswerBlock(block.type) || block.type === "DATE")
  ) {
    return true;
  }

  return rule.operator === "equals" || rule.operator === "not_equals";
}

function createIssue(
  issue: Omit<BranchValidationIssue, "severity"> & {
    severity?: BranchValidationIssueSeverity;
  },
): BranchValidationIssue {
  return {
    severity: issue.severity ?? "blocker",
    ...issue,
  };
}

function validateDefaultTarget(
  blocks: SerializedBlock[],
  block: SerializedBlock,
) {
  const issues: BranchValidationIssue[] = [];
  const defaultNextBlockId = getDefaultNextBlockId(block.config);

  if (!defaultNextBlockId) {
    return issues;
  }

  const sourceIndex = blocks.findIndex(
    (candidate) => candidate.id === block.id,
  );
  const targetIndex = blocks.findIndex(
    (candidate) => candidate.id === defaultNextBlockId,
  );

  if (targetIndex < 0) {
    issues.push(
      createIssue({
        code: "invalid-default-target",
        blockId: block.id,
        targetBlockId: defaultNextBlockId,
        message: `Default next step on “${getBlockDisplayLabel(block)}” points to a missing block.`,
      }),
    );
    return issues;
  }

  if (targetIndex <= sourceIndex) {
    issues.push(
      createIssue({
        code: "backward-default-target",
        blockId: block.id,
        targetBlockId: defaultNextBlockId,
        message: `Default next step on “${getBlockDisplayLabel(block)}” must point to a later block.`,
      }),
    );
  }

  return issues;
}

function createRuleIdentity(block: SerializedBlock, rule: BranchRule) {
  return `${rule.operator}:${normalizeBranchRuleOperand(block, rule) ?? "<none>"}`;
}

function collectRuleWarnings(block: SerializedBlock, rules: BranchRule[]) {
  const warnings: BranchValidationIssue[] = [];

  rules.forEach((rule, ruleIndex) => {
    if (
      (block.type === "SHORT_TEXT" ||
        block.type === "LONG_TEXT" ||
        block.type === "LINK") &&
      rule.operator === "equals"
    ) {
      warnings.push(
        createIssue({
          severity: "warning",
          code: "fragile-text-match",
          blockId: block.id,
          ruleIndex,
          targetBlockId: rule.targetBlockId,
          value: rule.value,
          message: `Exact text matching on “${getBlockDisplayLabel(block)}” may be fragile if respondents vary punctuation or casing.`,
        }),
      );
    }
  });

  const firstIsNotEmptyIndex = rules.findIndex(
    (rule) => rule.operator === "is_not_empty",
  );

  if (firstIsNotEmptyIndex >= 0) {
    rules.slice(firstIsNotEmptyIndex + 1).forEach((rule, offset) => {
      if (rule.operator !== "is_empty") {
        warnings.push(
          createIssue({
            severity: "warning",
            code: "overlapping-rule",
            blockId: block.id,
            ruleIndex: firstIsNotEmptyIndex + offset + 1,
            targetBlockId: rule.targetBlockId,
            value: rule.value,
            message: `A later rule on “${getBlockDisplayLabel(block)}” may never run because an earlier “is not empty” rule matches first.`,
          }),
        );
      }
    });
  }

  if (
    (block.type === "SINGLE_CHOICE" || block.type === "AGREEMENT") &&
    getDefaultNextBlockId(block.config)
  ) {
    const explicitCoverage = new Set(
      rules
        .filter((rule) => rule.operator === "equals")
        .map((rule) => normalizeBranchRuleOperand(block, rule))
        .filter((value): value is string => Boolean(value)),
    );

    const expectedValues =
      block.type === "SINGLE_CHOICE"
        ? (block.config as ChoiceBlockConfig).options
        : [AGREEMENT_ANSWER_VALUES.AGREED, AGREEMENT_ANSWER_VALUES.NOT_AGREED];

    if (
      explicitCoverage.size > 0 &&
      explicitCoverage.size < expectedValues.length
    ) {
      warnings.push(
        createIssue({
          severity: "warning",
          code: "partial-choice-coverage",
          blockId: block.id,
          message: `Some answers on “${getBlockDisplayLabel(block)}” fall through to the default route. Double-check that this is intentional.`,
        }),
      );
    }
  }

  return warnings;
}

function validateBlockRules(blocks: SerializedBlock[], block: SerializedBlock) {
  const issues: BranchValidationIssue[] = [];
  const sourceIndex = blocks.findIndex(
    (candidate) => candidate.id === block.id,
  );
  const seenRuleIdentities = new Set<string>();
  const rules = getBranchRules(block.config);

  for (const [ruleIndex, rule] of rules.entries()) {
    if (!isRuleSupportedForBlock(block, rule.operator)) {
      issues.push(
        createIssue({
          code: "unsupported-operator",
          blockId: block.id,
          ruleIndex,
          targetBlockId: rule.targetBlockId,
          value: rule.value,
          message: `The operator on a branch rule for “${getBlockDisplayLabel(block)}” is not supported for this block type.`,
        }),
      );
      continue;
    }

    if (!isRuleConditionValid(block, rule)) {
      issues.push(
        createIssue({
          code: "invalid-condition",
          blockId: block.id,
          ruleIndex,
          targetBlockId: rule.targetBlockId,
          value: rule.value,
          message: `Branch rule on “${getBlockDisplayLabel(block)}” has an invalid condition value.`,
        }),
      );
      continue;
    }

    const ruleIdentity = createRuleIdentity(block, rule);

    if (seenRuleIdentities.has(ruleIdentity)) {
      issues.push(
        createIssue({
          code: "duplicate-condition",
          blockId: block.id,
          ruleIndex,
          targetBlockId: rule.targetBlockId,
          value: rule.value,
          message: `Branch rule on “${getBlockDisplayLabel(block)}” duplicates an earlier condition.`,
        }),
      );
    }

    seenRuleIdentities.add(ruleIdentity);

    const targetIndex = blocks.findIndex(
      (candidate) => candidate.id === rule.targetBlockId,
    );

    if (targetIndex < 0) {
      issues.push(
        createIssue({
          code: "invalid-target",
          blockId: block.id,
          ruleIndex,
          targetBlockId: rule.targetBlockId,
          value: rule.value,
          message: `Branch rule on “${getBlockDisplayLabel(block)}” points to a missing block.`,
        }),
      );
      continue;
    }

    if (targetIndex <= sourceIndex) {
      issues.push(
        createIssue({
          code: "backward-target",
          blockId: block.id,
          ruleIndex,
          targetBlockId: rule.targetBlockId,
          value: rule.value,
          message: `Branch rule on “${getBlockDisplayLabel(block)}” must point to a later block.`,
        }),
      );
    }
  }

  return {
    blockers: issues,
    warnings: collectRuleWarnings(block, rules),
  } satisfies BranchValidationAnalysis;
}

function getReachableBlockIds(blocks: SerializedBlock[]) {
  if (!blocks.length) {
    return new Set<string>();
  }

  const reachable = new Set<string>();
  const queue = [blocks[0].id];

  while (queue.length) {
    const currentBlockId = queue.shift();

    if (!currentBlockId || reachable.has(currentBlockId)) {
      continue;
    }

    reachable.add(currentBlockId);

    const currentBlock = blocks.find((block) => block.id === currentBlockId);

    if (!currentBlock) {
      continue;
    }

    for (const nextBlockId of getPossibleNextBlockIds(blocks, currentBlock)) {
      if (!reachable.has(nextBlockId)) {
        queue.push(nextBlockId);
      }
    }
  }

  return reachable;
}

// Only the last block of a page decides where the page goes. On a page with
// more than one block, routing on any earlier block sits there unused, which
// is easy to miss in the builder, so it gets a warning. Without a page
// registry every block resolves to its own page and nothing is ignored.
function collectIgnoredPageRuleWarnings(
  blocks: SerializedBlock[],
  pages: ResolvedPage[],
) {
  const warnings: BranchValidationIssue[] = [];

  for (const page of pages) {
    if (page.blocks.length < 2) {
      continue;
    }

    for (const block of page.blocks.slice(0, -1)) {
      const carriesRouting =
        getBranchRules(block.config).length > 0 ||
        Boolean(getDefaultNextBlockId(block.config));

      if (!carriesRouting) {
        continue;
      }

      warnings.push(
        createIssue({
          severity: "warning",
          code: "ignored-page-rules",
          blockId: block.id,
          message: `Branch rules on “${getBlockDisplayLabel(block)}” are ignored because the block is not last on its page.`,
        }),
      );
    }
  }

  return warnings;
}

// A branch into a repeating page opens its first instance, which is almost
// never what the author meant, so every rule and explicit default target that
// resolves there gets a warning. Stored repeat settings count even when they
// do not resolve: the builder reports the degraded settings separately.
// Backward and missing targets never run (they already have their blockers),
// so only forward targets warn here.
function collectRepeatTargetWarnings(
  blocks: SerializedBlock[],
  pages: ResolvedPage[],
) {
  const warnings: BranchValidationIssue[] = [];
  const repeatingPageIds = new Set(
    pages.filter((page) => page.definition?.repeat).map((page) => page.id),
  );

  if (!repeatingPageIds.size) {
    return warnings;
  }

  for (const [sourceIndex, block] of blocks.entries()) {
    const targets: Array<{ targetBlockId: string; ruleIndex?: number }> =
      getBranchRules(block.config).map((rule, ruleIndex) => ({
        targetBlockId: rule.targetBlockId,
        ruleIndex,
      }));

    const defaultNextBlockId = getDefaultNextBlockId(block.config);
    if (defaultNextBlockId) {
      targets.push({ targetBlockId: defaultNextBlockId });
    }

    for (const target of targets) {
      const targetIndex = blocks.findIndex(
        (candidate) => candidate.id === target.targetBlockId,
      );

      if (targetIndex <= sourceIndex) {
        continue;
      }

      const targetPage = findPageByBlock(pages, target.targetBlockId);
      if (!targetPage || !repeatingPageIds.has(targetPage.id)) {
        continue;
      }

      warnings.push(
        createIssue({
          severity: "warning",
          code: "ignored-repeat-target",
          blockId: block.id,
          ruleIndex: target.ruleIndex,
          targetBlockId: target.targetBlockId,
          message: `A branch from “${getBlockDisplayLabel(block)}” into the repeating page of “${getBlockDisplayLabel(blocks[targetIndex])}” opens its first instance.`,
        }),
      );
    }
  }

  return warnings;
}

export function analyzeBranchingGraph(
  blocks: SerializedBlock[],
  pagesJson?: unknown,
): BranchValidationAnalysis {
  const blockers: BranchValidationIssue[] = [];
  const warnings: BranchValidationIssue[] = [];
  const pages = resolvePages(blocks, pagesJson ?? null);

  for (const block of blocks) {
    blockers.push(...validateDefaultTarget(blocks, block));
    const ruleAnalysis = validateBlockRules(blocks, block);
    blockers.push(...ruleAnalysis.blockers);
    warnings.push(...ruleAnalysis.warnings);
  }

  warnings.push(...collectIgnoredPageRuleWarnings(blocks, pages));
  warnings.push(...collectRepeatTargetWarnings(blocks, pages));

  const reachableBlockIds = getReachableBlockIds(blocks);

  for (const block of blocks) {
    if (!reachableBlockIds.has(block.id)) {
      blockers.push(
        createIssue({
          code: "unreachable-block",
          blockId: block.id,
          message: `“${getBlockDisplayLabel(block)}” is unreachable from the start of the form.`,
        }),
      );
    }
  }

  return { blockers, warnings };
}

export function validateBranchingGraph(blocks: SerializedBlock[]) {
  return analyzeBranchingGraph(blocks).blockers;
}

export function resolveVisitedBlockIds(
  blocks: SerializedBlock[],
  answers: Record<string, string | string[]>,
) {
  if (!blocks.length) {
    return [];
  }

  const visitedBlockIds: string[] = [];
  let currentBlockId: string | null = blocks[0].id;
  let safetyCounter = 0;

  while (currentBlockId && safetyCounter < blocks.length) {
    visitedBlockIds.push(currentBlockId);
    currentBlockId = resolveNextBlockId(blocks, currentBlockId, answers);
    safetyCounter += 1;
  }

  return visitedBlockIds;
}

// The page transition rides on the block-level mechanics of the page's last
// block: its rules and default target resolve to a block, and the page
// containing that block is the next page. endForm or the end of the block
// list ends the form. Rules on non-last blocks never run, so they cannot
// influence the exit.
export function resolveNextPageId(
  pages: ResolvedPage[],
  currentPageId: string,
  answers: Record<string, unknown>,
): string | null {
  const currentPage = pages.find((page) => page.id === currentPageId) ?? null;

  if (!currentPage) {
    return null;
  }

  const lastBlock = currentPage.blocks[currentPage.blocks.length - 1] ?? null;

  if (!lastBlock) {
    return null;
  }

  // resolveNextBlockId walks the saved order, so the blocks are flattened in
  // position order rather than page by page.
  const orderedBlocks = pages
    .flatMap((page) => page.blocks)
    .sort((a, b) => a.position - b.position);

  const nextBlockId = resolveNextBlockId(
    orderedBlocks,
    lastBlock.id,
    answers as Record<string, string | string[]>,
  );

  if (!nextBlockId) {
    return null;
  }

  return findPageByBlock(pages, nextBlockId)?.id ?? null;
}

export function getBranchTargetBlocks(
  blocks: SerializedBlock[],
  sourceBlockId: string,
) {
  const sourceBlock = blocks.find((block) => block.id === sourceBlockId);

  if (!sourceBlock) {
    return [];
  }

  return blocks.filter((block) => block.position > sourceBlock.position);
}

export function getBranchRuleValueHint(block: SerializedBlock) {
  if (block.type === "SINGLE_CHOICE" || block.type === "MULTIPLE_CHOICE") {
    const options = (block.config as ChoiceBlockConfig).options;
    return options[0] ?? "Option 1";
  }

  if (block.type === "NUMBER") {
    return "42";
  }

  if (block.type === "RATING") {
    return String((block.config as RatingBlockConfig).max);
  }

  if (block.type === "LINK") {
    return "https://example.com";
  }

  if (block.type === "DATE") {
    return "2026-01-31";
  }

  if (block.type === "AGREEMENT") {
    const label = (block.config as AgreementBlockConfig).label.trim();
    return label
      ? AGREEMENT_ANSWER_VALUES.AGREED
      : AGREEMENT_ANSWER_VALUES.AGREED;
  }

  return "Exact answer value";
}
