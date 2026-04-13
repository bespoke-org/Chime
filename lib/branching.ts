import {
  AGREEMENT_ANSWER_VALUES,
  branchOperatorNeedsValue,
  getBranchRules,
  getDefaultNextBlockId,
  getSupportedBranchOperators,
  isAgreementAnswerValue,
  isQuestionBlock,
  isValidDateAnswer,
  isValidLinkAnswer,
  parseNumericAnswer,
  type AgreementBlockConfig,
  type BranchOperator,
  type BranchRule,
  type ChoiceBlockConfig,
  type SerializedBlock,
} from "@/lib/blocks";

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
  | "partial-choice-coverage";

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
    key: `branching.issueMessages.${issue.code}`,
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

  if (block.type === "NUMBER") {
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

  if (block.type === "NUMBER") {
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

      if (block.type === "NUMBER") {
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
    block.type === "NUMBER" ||
    block.type === "LINK" ||
    block.type === "DATE"
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

function getPossibleNextBlockIds(
  blocks: SerializedBlock[],
  block: SerializedBlock,
) {
  const blockIndex = blocks.findIndex((candidate) => candidate.id === block.id);

  if (blockIndex < 0) {
    return [];
  }

  const nextIds = new Set<string>();

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
    (block.type === "NUMBER" || block.type === "DATE")
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

export function analyzeBranchingGraph(
  blocks: SerializedBlock[],
): BranchValidationAnalysis {
  const blockers: BranchValidationIssue[] = [];
  const warnings: BranchValidationIssue[] = [];

  for (const block of blocks) {
    blockers.push(...validateDefaultTarget(blocks, block));
    const ruleAnalysis = validateBlockRules(blocks, block);
    blockers.push(...ruleAnalysis.blockers);
    warnings.push(...ruleAnalysis.warnings);
  }

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
