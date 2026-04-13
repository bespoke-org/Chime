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
import {
  ChevronDown,
  Copy,
  ExternalLink,
  EyeOff,
  Globe,
  GripVertical,
  Link as LinkIcon,
  LoaderCircle,
  MessagesSquare,
  Plus,
  Save,
  Settings2,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { Dispatch, SetStateAction } from "react";

import { useI18n } from "@/components/i18n-provider";
import { FormStatusBadge } from "@/components/form-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AGREEMENT_ANSWER_VALUES,
  branchOperatorNeedsValue,
  blockTypeTranslationKeys,
  getVisibleBranchOperators,
  isQuestionBlock,
  type AgreementBlockConfig,
  type BlockConfig,
  type BranchOperator,
  type LinkBlockConfig,
  type LongTextBlockConfig,
  type NumberBlockConfig,
  type ShortTextBlockConfig,
  type TextBlockConfig,
} from "@/lib/blocks";
import {
  getBlockDisplayLabel,
  getBranchRuleValueHint,
  getBranchTargetBlocks,
  getBranchValidationIssueI18n,
  type BranchValidationIssue,
} from "@/lib/branching";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";

export type FormMetadataDraft = {
  title: string;
  completionTitle: string;
  completionMessage: string;
  completionLinkLabel: string;
  completionLinkUrl: string;
  slug: string;
};

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

export function BuilderHeader({
  form,
  settingsSelected,
  busy,
  shareHref,
  onOpenSettings,
  onPublish,
  onUnpublish,
  onCopyShareLink,
}: {
  form: BuilderForm;
  settingsSelected: boolean;
  busy: string | null;
  shareHref: string;
  onOpenSettings: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onCopyShareLink: () => void;
}) {
  const { t } = useI18n();
  const workspaceLabel =
    form.workspace.kind === "personal"
      ? t("workspace.personal")
      : form.workspace.label;
  const [isPublicationMenuOpen, setIsPublicationMenuOpen] =
    React.useState(false);
  const isPublished = form.status === "PUBLISHED";
  const isPublishBusy = busy === "publish";

  return (
    <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-[var(--ink)]">
            {form.title}
          </h1>
          <FormStatusBadge status={form.status} />
        </div>
        <p className="mt-2 text-xs font-medium uppercase text-[var(--muted)]">
          {workspaceLabel}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <Button
          variant={settingsSelected ? "default" : "secondary"}
          onClick={onOpenSettings}
        >
          <Settings2 className="size-4" />
          {t("builder.settings")}
        </Button>
        <Link href={`/forms/${form.id}/responses`}>
          <Button variant="secondary">
            <MessagesSquare className="size-4" />
            {t("builder.responses", { count: form.responseCount })}
          </Button>
        </Link>
        <Popover
          open={isPublicationMenuOpen}
          onOpenChange={setIsPublicationMenuOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant={isPublished ? "default" : "secondary"}
              aria-haspopup="menu"
              aria-expanded={isPublicationMenuOpen}
            >
              {isPublishBusy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Globe className="size-4" />
              )}
              {t("builder.publicationMenu")}
              <ChevronDown className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <div className="grid gap-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:hover:bg-transparent"
                disabled={isPublishBusy}
                onClick={() => {
                  setIsPublicationMenuOpen(false);
                  if (isPublished) {
                    onUnpublish();
                    return;
                  }

                  onPublish();
                }}
              >
                {isPublished ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Upload className="size-4" />
                )}
                {t(isPublished ? "builder.unpublish" : "builder.publish")}
              </button>
              <div className="my-1 h-px bg-[color:var(--line)]" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent-soft)]"
                onClick={() => {
                  setIsPublicationMenuOpen(false);
                  onCopyShareLink();
                }}
              >
                <Copy className="size-4" />
                {t("builder.copyLink")}
              </button>
              <Link
                href={shareHref}
                target="_blank"
                className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent-soft)]"
                onClick={() => setIsPublicationMenuOpen(false)}
              >
                <ExternalLink className="size-4" />
                {t("builder.openRunner")}
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}

export function FormSettingsPanel({
  metadataDraft,
  setMetadataDraft,
  shareHref,
  copyShareLink,
  deleteForm,
  saveMetadata,
  busy,
}: {
  metadataDraft: FormMetadataDraft;
  setMetadataDraft: Dispatch<SetStateAction<FormMetadataDraft>>;
  shareHref: string;
  copyShareLink: () => void;
  deleteForm: () => void;
  saveMetadata: () => void;
  busy: string | null;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-4xl text-[var(--ink)]">
          {t("builder.settingsTitle")}
        </h2>
      </div>

      <div className="grid gap-5">
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            {t("builder.titleField")}
          </span>
          <Input
            value={metadataDraft.title}
            onChange={(event) =>
              setMetadataDraft((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className="grid gap-5 border-t border-[color:var(--line)] pt-6">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">
            {t("builder.publicRoute")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("builder.publicRouteHelp")}
          </p>
        </div>
        <div className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            {t("builder.shareSlug")}
          </span>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-within:border-[color:var(--line-strong)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
              <span className="shrink-0 border-r border-[color:var(--line)] px-4 font-mono text-[13px] text-[var(--muted)]">
                /f/
              </span>
              <input
                value={metadataDraft.slug}
                className="h-full w-full min-w-0 bg-transparent px-4 font-mono text-[13px] text-[var(--ink)] outline-none"
                onChange={(event) =>
                  setMetadataDraft((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-3 lg:shrink-0">
              <Button variant="secondary" onClick={copyShareLink}>
                <Copy className="size-4" />
                {t("builder.copyLink")}
              </Button>
              <Link href={shareHref} target="_blank">
                <Button variant="secondary">
                  <LinkIcon className="size-4" />
                  {t("builder.openRunner")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 border-t border-[color:var(--line)] pt-6">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">
            {t("builder.afterSubmission")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t("builder.afterSubmissionDescription")}
          </p>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.completionTitle")}
            </span>
            <Input
              value={metadataDraft.completionTitle}
              onChange={(event) =>
                setMetadataDraft((current) => ({
                  ...current,
                  completionTitle: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.completionMessage")}
            </span>
            <Textarea
              value={metadataDraft.completionMessage}
              onChange={(event) =>
                setMetadataDraft((current) => ({
                  ...current,
                  completionMessage: event.target.value,
                }))
              }
            />
          </label>
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.followUpLabel")}
              </span>
              <Input
                value={metadataDraft.completionLinkLabel}
                placeholder={t("builder.followUpLabelPlaceholder")}
                onChange={(event) =>
                  setMetadataDraft((current) => ({
                    ...current,
                    completionLinkLabel: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.followUpUrl")}
              </span>
              <Input
                value={metadataDraft.completionLinkUrl}
                placeholder={t("builder.followUpUrlPlaceholder")}
                onChange={(event) =>
                  setMetadataDraft((current) => ({
                    ...current,
                    completionLinkUrl: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-6">
        <Button variant="danger" onClick={deleteForm}>
          {busy === "delete-form" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {t("builder.deleteForm")}
        </Button>
        <Button onClick={saveMetadata}>
          {busy === "metadata" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {t("builder.saveFormSettings")}
        </Button>
      </div>
    </div>
  );
}

function SortableChoiceOptionRow({
  option,
  index,
  optionCount,
  onChange,
  onRemove,
}: {
  option: ChoiceOptionDraft;
  index: number;
  optionCount: number;
  onChange: (optionId: string, value: string) => void;
  onRemove: (optionId: string) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: option.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="flex items-center gap-2 rounded-[18px] border border-[color:var(--line)] bg-[var(--surface)] p-3"
    >
      <button
        type="button"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
        aria-label={t("builder.dragOptionAria", { number: index + 1 })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        value={option.value}
        placeholder={t("builder.option", { number: index + 1 })}
        onChange={(event) => onChange(option.id, event.target.value)}
      />
      <button
        type="button"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--muted)] transition hover:bg-[var(--danger-hover)] hover:text-[var(--danger-contrast)] hover:border-[var(--danger-hover)] disabled:opacity-100 disabled:text-[var(--line-strong)]"
        aria-label={t("builder.removeOptionAria", { number: index + 1 })}
        disabled={optionCount <= 2}
        onClick={() => onRemove(option.id)}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

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
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          aria-label={t("builder.dragBranchRuleAria", { number: index + 1 })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(220px,0.9fr)]">
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

export function BlockEditorPanel({
  allBlocks,
  blockDraft,
  selectedBlockIcon: SelectedBlockIcon,
  choiceOptionsDraft,
  branchRulesDraft,
  branchValidationIssues,
  setChoiceOptionsDraft,
  setBranchRulesDraft,
  setBlockDraft,
  deleteBlock,
  saveBlock,
  busy,
}: {
  allBlocks: BuilderBlock[];
  blockDraft: BuilderBlock;
  selectedBlockIcon: LucideIcon | null;
  choiceOptionsDraft: ChoiceOptionDraft[];
  branchRulesDraft: BranchRuleDraft[];
  branchValidationIssues: BranchValidationIssue[];
  setChoiceOptionsDraft: Dispatch<SetStateAction<ChoiceOptionDraft[]>>;
  setBranchRulesDraft: Dispatch<SetStateAction<BranchRuleDraft[]>>;
  setBlockDraft: Dispatch<SetStateAction<BuilderBlock | null>>;
  deleteBlock: (blockId: string) => void;
  saveBlock: () => void;
  busy: string | null;
}) {
  const { t } = useI18n();
  const optionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const branchRuleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
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
  const defaultNextSelectValue = defaultNextBlockId ?? "__linear__";
  const staleDefaultNextMissing = Boolean(
    defaultNextBlockId &&
    !branchTargetOptions.some(
      (targetBlock) => targetBlock.id === defaultNextBlockId,
    ),
  );

  function updateConfig(patch: Record<string, unknown>) {
    setBlockDraft((current) =>
      current
        ? {
            ...current,
            config: {
              ...(current.config as Record<string, unknown>),
              ...patch,
            } as BlockConfig,
          }
        : current,
    );
  }

  function syncChoiceOptions(nextOptions: ChoiceOptionDraft[]) {
    setChoiceOptionsDraft(nextOptions);
    updateConfig({ options: nextOptions.map((option) => option.value) });
  }

  function updateChoiceOption(optionId: string, value: string) {
    syncChoiceOptions(
      choiceOptionsDraft.map((option) =>
        option.id === optionId ? { ...option, value } : option,
      ),
    );
  }

  function addChoiceOption() {
    if (choiceOptionsDraft.length >= 10) {
      return;
    }

    syncChoiceOptions([
      ...choiceOptionsDraft,
      {
        id: crypto.randomUUID(),
        value: t("builder.option", { number: choiceOptionsDraft.length + 1 }),
      },
    ]);
  }

  function removeChoiceOption(optionId: string) {
    if (choiceOptionsDraft.length <= 2) {
      return;
    }

    syncChoiceOptions(
      choiceOptionsDraft.filter((option) => option.id !== optionId),
    );
  }

  function handleChoiceOptionDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = choiceOptionsDraft.findIndex(
      (option) => option.id === active.id,
    );
    const newIndex = choiceOptionsDraft.findIndex(
      (option) => option.id === over.id,
    );

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    syncChoiceOptions(arrayMove(choiceOptionsDraft, oldIndex, newIndex));
  }

  function syncBranchRules(nextRules: BranchRuleDraft[]) {
    setBranchRulesDraft(nextRules);
    updateConfig({
      branchRules: nextRules.map((rule) => ({
        operator: rule.operator,
        value: rule.value,
        targetBlockId: rule.targetBlockId,
      })),
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
      {
        id: crypto.randomUUID(),
        operator: getVisibleBranchOperators(blockDraft.type)[0] ?? "equals",
        value:
          blockDraft.type === "AGREEMENT"
            ? AGREEMENT_ANSWER_VALUES.AGREED
            : null,
        targetBlockId: firstTarget.id,
      },
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
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-3">
          {SelectedBlockIcon ? (
            <SelectedBlockIcon className="size-6 text-[var(--ink)]" />
          ) : null}
          <h2 className="font-display text-4xl text-[var(--ink)]">
            {t(blockTypeTranslationKeys[blockDraft.type])}
          </h2>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-2 text-sm text-[var(--muted)]">
          {blockDraft.type === "TEXT" ? (
            <span className="font-medium text-[var(--ink)]">
              {t("builder.headingField")}
            </span>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.prompt")}
              </span>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                <Checkbox
                  checked={blockDraft.required}
                  onChange={(event) =>
                    setBlockDraft((current) =>
                      current
                        ? { ...current, required: event.target.checked }
                        : current,
                    )
                  }
                />
                {t("builder.requiredToggle")}
              </label>
            </div>
          )}
          <Input
            value={blockDraft.title}
            onChange={(event) =>
              setBlockDraft((current) =>
                current ? { ...current, title: event.target.value } : current,
              )
            }
          />
        </div>

        {blockDraft.type !== "TEXT" ? (
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.supportText")}
            </span>
            <Textarea
              value={blockDraft.description}
              onChange={(event) =>
                setBlockDraft((current) =>
                  current
                    ? { ...current, description: event.target.value }
                    : current,
                )
              }
            />
          </label>
        ) : null}

        {blockDraft.type === "TEXT" ? (
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.bodyCopy")}
            </span>
            <Textarea
              value={(blockDraft.config as TextBlockConfig).body}
              onChange={(event) => updateConfig({ body: event.target.value })}
            />
          </label>
        ) : null}

        {(blockDraft.type === "SHORT_TEXT" ||
          blockDraft.type === "LONG_TEXT") && (
          <>
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.placeholder")}
              </span>
              <Input
                value={
                  blockDraft.type === "SHORT_TEXT"
                    ? (blockDraft.config as ShortTextBlockConfig).placeholder
                    : (blockDraft.config as LongTextBlockConfig).placeholder
                }
                onChange={(event) =>
                  updateConfig({ placeholder: event.target.value })
                }
              />
            </label>

            <div className="grid gap-3 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-4 text-sm text-[var(--muted)]">
              <label className="flex items-center gap-3 text-[var(--ink)]">
                <Checkbox
                  checked={
                    (
                      blockDraft.config as
                        | ShortTextBlockConfig
                        | LongTextBlockConfig
                    ).validationRegex !== null
                  }
                  onChange={(event) =>
                    updateConfig({
                      validationRegex: event.target.checked ? "" : null,
                    })
                  }
                />
                {t("builder.regexValidation")}
              </label>

              {(blockDraft.config as ShortTextBlockConfig | LongTextBlockConfig)
                .validationRegex !== null ? (
                <label className="grid gap-2">
                  <span className="font-medium text-[var(--ink)]">
                    {t("builder.regexPattern")}
                  </span>
                  <Input
                    value={
                      (
                        blockDraft.config as
                          | ShortTextBlockConfig
                          | LongTextBlockConfig
                      ).validationRegex ?? ""
                    }
                    placeholder="^[A-Z0-9]+$"
                    onChange={(event) =>
                      updateConfig({ validationRegex: event.target.value })
                    }
                  />
                </label>
              ) : null}

              <p className="text-xs text-[var(--muted)]">
                {t("builder.regexHelp")}
              </p>
            </div>
          </>
        )}

        {blockDraft.type === "NUMBER" ? (
          <div className="grid gap-5 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-4 text-sm text-[var(--muted)]">
            <label className="grid gap-2">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.placeholder")}
              </span>
              <Input
                value={(blockDraft.config as NumberBlockConfig).placeholder}
                onChange={(event) =>
                  updateConfig({ placeholder: event.target.value })
                }
              />
            </label>

            <label className="flex items-center gap-3 text-[var(--ink)]">
              <Checkbox
                checked={(blockDraft.config as NumberBlockConfig).allowFloat}
                onChange={(event) =>
                  updateConfig({ allowFloat: event.target.checked })
                }
              />
              {t("builder.allowFloats")}
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {t("builder.minimumValue")}
                </span>
                <Input
                  type="number"
                  step={
                    (blockDraft.config as NumberBlockConfig).allowFloat
                      ? "any"
                      : "1"
                  }
                  value={(blockDraft.config as NumberBlockConfig).min ?? ""}
                  onChange={(event) =>
                    updateConfig({
                      min:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {t("builder.maximumValue")}
                </span>
                <Input
                  type="number"
                  step={
                    (blockDraft.config as NumberBlockConfig).allowFloat
                      ? "any"
                      : "1"
                  }
                  value={(blockDraft.config as NumberBlockConfig).max ?? ""}
                  onChange={(event) =>
                    updateConfig({
                      max:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ) : null}

        {blockDraft.type === "LINK" ? (
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.placeholder")}
            </span>
            <Input
              value={(blockDraft.config as LinkBlockConfig).placeholder}
              onChange={(event) =>
                updateConfig({ placeholder: event.target.value })
              }
            />
          </label>
        ) : null}

        {blockDraft.type === "AGREEMENT" ? (
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.checkboxLabel")}
            </span>
            <Input
              value={(blockDraft.config as AgreementBlockConfig).label}
              onChange={(event) => updateConfig({ label: event.target.value })}
            />
          </label>
        ) : null}

        {(blockDraft.type === "SINGLE_CHOICE" ||
          blockDraft.type === "MULTIPLE_CHOICE") && (
          <div className="grid gap-3 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.choiceOptions")}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={addChoiceOption}
                disabled={choiceOptionsDraft.length >= 10}
              >
                <Plus className="size-4" />
                {t("builder.addOption")}
              </Button>
            </div>
            <DndContext
              sensors={optionSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleChoiceOptionDragEnd}
            >
              <SortableContext
                items={choiceOptionsDraft.map((option) => option.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-3">
                  {choiceOptionsDraft.map((option, index) => (
                    <SortableChoiceOptionRow
                      key={option.id}
                      option={option}
                      index={index}
                      optionCount={choiceOptionsDraft.length}
                      onChange={updateChoiceOption}
                      onRemove={removeChoiceOption}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <p className="text-xs text-[var(--muted)]">
              {t("builder.optionsHelp")}
            </p>
          </div>
        )}

        {isQuestionBlock(blockDraft.type) ? (
          <div className="grid gap-4 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-4 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--ink)]">
                  {t("builder.branchingTitle")}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t("builder.branchingDescription")}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={addBranchRule}
                disabled={branchTargetOptions.length === 0}
              >
                <Plus className="size-4" />
                {t("builder.addBranchRule")}
              </Button>
            </div>

            {branchRulesDraft.length ? (
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

            {branchTargetOptions.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                {t("builder.branchingNoTargets")}
              </p>
            ) : null}
            <p className="text-xs text-[var(--muted)]">
              {t("builder.branchingHelp", { value: branchRulePlaceholder })}
            </p>

            {blockBranchBlockers.length ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-[var(--ink)]">
                <p className="font-medium">
                  {t("builder.branchingBlockersForBlockTitle")}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
                  {blockBranchBlockers.map((issue, index) => {
                    const issueI18n = getBranchValidationIssueI18n(
                      issue,
                      allBlocks,
                    );
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
                    const issueI18n = getBranchValidationIssueI18n(
                      issue,
                      allBlocks,
                    );
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
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-6">
        <Button variant="danger" onClick={() => deleteBlock(blockDraft.id)}>
          {busy === `delete-${blockDraft.id}` ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {t("builder.deleteBlock")}
        </Button>
        <Button onClick={saveBlock}>
          {busy === `block-${blockDraft.id}` ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {t("builder.saveBlock")}
        </Button>
      </div>
    </div>
  );
}

export function EmptyEditorState({
  onAddShortText,
}: {
  onAddShortText: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[420px] items-center justify-center border-t border-dashed border-[color:var(--line)] p-10 text-center">
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--accent)]">
          {t("builder.nothingSelected")}
        </p>
        <h2 className="mt-4 font-display text-4xl text-[var(--ink)]">
          {t("builder.nothingSelectedTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
          {t("builder.nothingSelectedDescription")}
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={onAddShortText}>
            <Plus className="size-4" />
            {t("builder.addShortTextQuestion")}
          </Button>
        </div>
      </div>
    </div>
  );
}
