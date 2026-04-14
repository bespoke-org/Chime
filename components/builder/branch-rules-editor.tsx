"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGREEMENT_ANSWER_VALUES,
  branchOperatorNeedsValue,
  getVisibleBranchOperators,
  isQuestionBlock,
  type BranchOperator,
} from "@/lib/blocks";
import {
  getBlockDisplayLabel,
  getBranchRuleValueHint,
  getBranchTargetBlocks,
  getBranchValidationIssueI18n,
  type BranchValidationIssue,
} from "@/lib/branching";
import {
  createDefaultBranchRuleDraft,
  serializeBranchRuleDrafts,
  type BranchRuleDraft,
} from "@/lib/form-builder-drafts";
import type { BuilderBlock } from "@/lib/form-types";

function SortableBranchRuleRow({
  block,
  rule,
  index,
  placeholder,
  targetOptions,
  onChange,
  onRemove,
}: {
  block: BuilderBlock;
  rule: BranchRuleDraft;
  index: number;
  placeholder: string;
  targetOptions: BuilderBlock[];
  onChange: (
    ruleId: string,
    patch: Partial<
      Pick<BranchRuleDraft, "operator" | "value" | "targetBlockId">
    >,
  ) => void;
  onRemove: (ruleId: string) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: rule.id });
  const staleTargetMissing =
    rule.targetBlockId &&
    !targetOptions.some((targetBlock) => targetBlock.id === rule.targetBlockId);
  const visibleOperators = getVisibleBranchOperators(block.type);
  const supportedOperators = visibleOperators.includes(rule.operator)
    ? visibleOperators
    : [rule.operator, ...visibleOperators];
  const showValueInput =
    branchOperatorNeedsValue(rule.operator) && block.type !== "AGREEMENT";
  const valueInputType =
    block.type === "NUMBER"
      ? "number"
      : block.type === "DATE"
        ? "date"
        : "text";
  const discreteOptions =
    block.type === "SINGLE_CHOICE" || block.type === "MULTIPLE_CHOICE"
      ? (block.config as { options: string[] }).options
      : block.type === "AGREEMENT"
        ? [AGREEMENT_ANSWER_VALUES.AGREED, AGREEMENT_ANSWER_VALUES.NOT_AGREED]
        : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="grid gap-3 rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] p-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          aria-label={t("builder.dragBranchRuleAria", { number: index + 1 })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="grid min-w-0 flex-1 gap-3">
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.branchOperator")}
            </span>
            <Select
              value={rule.operator}
              onValueChange={(value) =>
                onChange(rule.id, {
                  operator: value as BranchOperator,
                  value:
                    block.type === "AGREEMENT"
                      ? AGREEMENT_ANSWER_VALUES.AGREED
                      : branchOperatorNeedsValue(value as BranchOperator)
                        ? rule.value
                        : null,
                })
              }
            >
              <SelectTrigger className="h-10 w-full text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedOperators.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {block.type === "SINGLE_CHOICE" &&
                    (operator === "equals" || operator === "not_equals")
                      ? t(
                          `builder.branchOperatorLabels.singleChoice.${operator}`,
                        )
                      : block.type === "MULTIPLE_CHOICE" &&
                          operator === "contains_any"
                        ? t(
                            "builder.branchOperatorLabels.multipleChoice.contains_any",
                          )
                        : block.type === "AGREEMENT" &&
                            (operator === "equals" || operator === "not_equals")
                          ? t(
                              `builder.branchOperatorLabels.agreement.${operator}`,
                            )
                          : block.type === "DATE" &&
                              [
                                "equals",
                                "not_equals",
                                "gt",
                                "gte",
                                "lt",
                                "lte",
                              ].includes(operator)
                            ? t(`builder.branchOperatorLabels.date.${operator}`)
                            : t(`builder.branchOperators.${operator}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {showValueInput ? (
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.branchWhenAnswer")}
              </span>
              {discreteOptions ? (
                <Select
                  value={rule.value ?? undefined}
                  onValueChange={(value) => onChange(rule.id, { value })}
                >
                  <SelectTrigger className="h-10 w-full text-sm font-medium">
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {discreteOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {block.type === "AGREEMENT"
                          ? t(`builder.branchAgreementValues.${option}`)
                          : option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={valueInputType}
                  value={rule.value ?? ""}
                  placeholder={placeholder}
                  onChange={(event) =>
                    onChange(rule.id, { value: event.target.value })
                  }
                />
              )}
            </label>
          ) : (
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.branchWhenAnswer")}
              </span>
              <div className="flex h-10 items-center rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--muted)]">
                {t("builder.branchNoValueNeeded")}
              </div>
            </div>
          )}

          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.branchGoTo")}
            </span>
            <Select
              value={rule.targetBlockId}
              onValueChange={(value) =>
                onChange(rule.id, { targetBlockId: value })
              }
            >
              <SelectTrigger className="h-10 w-full text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {staleTargetMissing ? (
                  <SelectItem value={rule.targetBlockId}>
                    {t("builder.branchMissingTarget")}
                  </SelectItem>
                ) : null}
                {targetOptions.map((targetBlock) => (
                  <SelectItem key={targetBlock.id} value={targetBlock.id}>
                    {getBlockDisplayLabel(targetBlock)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--muted)] transition hover:bg-[var(--danger-hover)] hover:text-[var(--danger-contrast)] hover:border-[var(--danger-hover)]"
          aria-label={t("builder.removeBranchRuleAria", { number: index + 1 })}
          onClick={() => onRemove(rule.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function BranchRulesEditor({
  allBlocks,
  blockDraft,
  branchRulesDraft,
  branchValidationIssues,
  setBranchRulesDraft,
  updateConfig,
}: {
  allBlocks: BuilderBlock[];
  blockDraft: BuilderBlock;
  branchRulesDraft: BranchRuleDraft[];
  branchValidationIssues: BranchValidationIssue[];
  setBranchRulesDraft: Dispatch<SetStateAction<BranchRuleDraft[]>>;
  updateConfig: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const branchRuleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const canConfigureBranchRules = isQuestionBlock(blockDraft.type);
  const branchTargetOptions = getBranchTargetBlocks(allBlocks, blockDraft.id);
  const blockBranchIssues = branchValidationIssues.filter(
    (issue) => issue.blockId === blockDraft.id,
  );
  const blockBranchBlockers = blockBranchIssues.filter(
    (issue) => issue.severity === "blocker",
  );
  const blockBranchWarnings = blockBranchIssues.filter(
    (issue) => issue.severity === "warning",
  );
  const branchRulePlaceholder = getBranchRuleValueHint(blockDraft);
  const defaultNextBlockId =
    "defaultNextBlockId" in blockDraft.config
      ? blockDraft.config.defaultNextBlockId
      : null;
  const endForm =
    "endForm" in blockDraft.config ? blockDraft.config.endForm : false;
  const defaultNextSelectValue = defaultNextBlockId ?? "__linear__";
  const staleDefaultNextMissing = Boolean(
    defaultNextBlockId &&
    !branchTargetOptions.some(
      (targetBlock) => targetBlock.id === defaultNextBlockId,
    ),
  );

  function syncBranchRules(nextRules: BranchRuleDraft[]) {
    setBranchRulesDraft(nextRules);
    updateConfig({
      branchRules: serializeBranchRuleDrafts(nextRules),
    });
  }

  function updateBranchRule(
    ruleId: string,
    patch: Partial<
      Pick<BranchRuleDraft, "operator" | "value" | "targetBlockId">
    >,
  ) {
    syncBranchRules(
      branchRulesDraft.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule,
      ),
    );
  }

  function addBranchRule() {
    const firstTarget = branchTargetOptions[0];

    if (!firstTarget) {
      return;
    }

    syncBranchRules([
      ...branchRulesDraft,
      createDefaultBranchRuleDraft({
        blockType: blockDraft.type,
        targetBlockId: firstTarget.id,
      }),
    ]);
  }

  function removeBranchRule(ruleId: string) {
    syncBranchRules(branchRulesDraft.filter((rule) => rule.id !== ruleId));
  }

  function handleBranchRuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = branchRulesDraft.findIndex(
      (rule) => rule.id === active.id,
    );
    const newIndex = branchRulesDraft.findIndex((rule) => rule.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    syncBranchRules(arrayMove(branchRulesDraft, oldIndex, newIndex));
  }

  return (
    <div className="grid gap-4 text-sm text-[var(--muted)]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-[var(--ink)]">
          {t("builder.branchingTitle")}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={addBranchRule}
          disabled={endForm || branchTargetOptions.length === 0}
        >
          <Plus className="size-4" />
          {t("builder.addBranchRule")}
        </Button>
      </div>

      {!endForm && canConfigureBranchRules && branchRulesDraft.length ? (
        <DndContext
          sensors={branchRuleSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleBranchRuleDragEnd}
        >
          <SortableContext
            items={branchRulesDraft.map((rule) => rule.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-3">
              {branchRulesDraft.map((rule, index) => (
                <SortableBranchRuleRow
                  key={rule.id}
                  block={blockDraft}
                  rule={rule}
                  index={index}
                  placeholder={branchRulePlaceholder}
                  targetOptions={branchTargetOptions}
                  onChange={updateBranchRule}
                  onRemove={removeBranchRule}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      {!endForm && canConfigureBranchRules ? (
        <label className="grid gap-2 text-sm text-[var(--muted)] sm:max-w-md">
          <span className="font-medium text-[var(--ink)]">
            {t("builder.branchOtherwise")}
          </span>
          <Select
            value={defaultNextSelectValue}
            onValueChange={(value) =>
              updateConfig({
                defaultNextBlockId: value === "__linear__" ? null : value,
              })
            }
          >
            <SelectTrigger className="h-10 w-full text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__linear__">
                {t("builder.branchDefaultLinear")}
              </SelectItem>
              {staleDefaultNextMissing && defaultNextBlockId ? (
                <SelectItem value={defaultNextBlockId}>
                  {t("builder.branchMissingTarget")}
                </SelectItem>
              ) : null}
              {branchTargetOptions.map((targetBlock) => (
                <SelectItem key={targetBlock.id} value={targetBlock.id}>
                  {getBlockDisplayLabel(targetBlock)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {!endForm &&
      canConfigureBranchRules &&
      branchTargetOptions.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          {t("builder.branchingNoTargets")}
        </p>
      ) : null}
      <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
        <Checkbox
          checked={endForm}
          onChange={(event) =>
            updateConfig({
              endForm: event.target.checked,
            })
          }
        />
        <span className="font-medium text-[var(--ink)]">
          {t("builder.endFormAfterBlock")}
        </span>
      </label>

      {blockBranchBlockers.length ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-[var(--ink)]">
          <p className="font-medium">
            {t("builder.branchingBlockersForBlockTitle")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
            {blockBranchBlockers.map((issue, index) => {
              const issueI18n = getBranchValidationIssueI18n(issue, allBlocks);
              return (
                <li key={`${issue.code}-${issue.ruleIndex ?? index}`}>
                  {t(issueI18n.key, issueI18n.values)}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {blockBranchWarnings.length ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-sm text-[var(--ink)]">
          <p className="font-medium">
            {t("builder.branchingWarningsForBlockTitle")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
            {blockBranchWarnings.map((issue, index) => {
              const issueI18n = getBranchValidationIssueI18n(issue, allBlocks);
              return (
                <li key={`${issue.code}-${issue.ruleIndex ?? index}`}>
                  {t(issueI18n.key, issueI18n.values)}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
