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

import { BranchRulesEditor } from "@/components/builder/branch-rules-editor";
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
  blockTypeTranslationKeys,
  RATING_MAX_VALUES,
  RATING_MIN_VALUES,
  type AgreementBlockConfig,
  type BlockConfig,
  type LinkBlockConfig,
  type LongTextBlockConfig,
  type NumberBlockConfig,
  type RatingBlockConfig,
  type ShortTextBlockConfig,
  type TextBlockConfig,
} from "@/lib/blocks";
import { type BranchValidationIssue } from "@/lib/branching";
import {
  createChoiceOptionDraft,
  serializeChoiceOptionDrafts,
  type BranchRuleDraft,
  type ChoiceOptionDraft,
} from "@/lib/form-builder-drafts";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";
import { supportedLocales, type AppLocale } from "@/lib/i18n";

export type FormMetadataDraft = {
  title: string;
  completionTitle: string;
  completionMessage: string;
  completionLinkLabel: string;
  completionLinkUrl: string;
  respondentLocale: AppLocale | null;
  showProgress: boolean;
  allowBackNavigation: boolean;
  webhookUrl: string;
  webhookSecret: string;
  slug: string;
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
            {t("builder.appearance")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t("builder.appearanceDescription")}
          </p>
        </div>

        <div className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            {t("builder.respondentLanguage")}
          </span>
          <Select
            value={metadataDraft.respondentLocale ?? "visitor"}
            onValueChange={(value) =>
              setMetadataDraft((current) => ({
                ...current,
                respondentLocale:
                  value === "visitor" ? null : (value as AppLocale),
              }))
            }
          >
            <SelectTrigger className="h-11 px-4 text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visitor">
                {t("builder.respondentLanguageOptions.visitor")}
              </SelectItem>
              {supportedLocales.map((localeOption) => (
                <SelectItem key={localeOption} value={localeOption}>
                  {t(`settings.profile.localeOptions.${localeOption}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-[var(--muted)]">
            {t("builder.respondentLanguageHelp")}
          </span>
        </div>

        <label className="flex items-start gap-3 text-sm text-[var(--muted)]">
          <Checkbox
            checked={metadataDraft.showProgress}
            onChange={(event) =>
              setMetadataDraft((current) => ({
                ...current,
                showProgress: event.target.checked,
              }))
            }
          />
          <div className="grid gap-1">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.showProgress")}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {t("builder.showProgressHelp")}
            </span>
          </div>
        </label>

        <label className="flex items-start gap-3 text-sm text-[var(--muted)]">
          <Checkbox
            checked={metadataDraft.allowBackNavigation}
            onChange={(event) =>
              setMetadataDraft((current) => ({
                ...current,
                allowBackNavigation: event.target.checked,
              }))
            }
          />
          <div className="grid gap-1">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.allowBackNavigation")}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {t("builder.allowBackNavigationHelp")}
            </span>
          </div>
        </label>
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

      <div className="space-y-5 border-t border-[color:var(--line)] pt-6">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">
            {t("builder.webhook")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t("builder.webhookDescription")}
          </p>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.webhookUrl")}
            </span>
            <Input
              value={metadataDraft.webhookUrl}
              placeholder={t("builder.webhookUrlPlaceholder")}
              onChange={(event) =>
                setMetadataDraft((current) => ({
                  ...current,
                  webhookUrl: event.target.value,
                }))
              }
            />
            <span className="text-xs text-[var(--muted)]">
              {t("builder.webhookUrlHelp")}
            </span>
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.webhookSecret")}
            </span>
            <Input
              value={metadataDraft.webhookSecret}
              autoComplete="off"
              onChange={(event) =>
                setMetadataDraft((current) => ({
                  ...current,
                  webhookSecret: event.target.value,
                }))
              }
            />
            <span className="text-xs text-[var(--muted)]">
              {t("builder.webhookSecretHelp")}
            </span>
          </label>
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
    updateConfig({ options: serializeChoiceOptionDrafts(nextOptions) });
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
      createChoiceOptionDraft(
        t("builder.option", { number: choiceOptionsDraft.length + 1 }),
      ),
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

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-3">
          {SelectedBlockIcon ? (
            <SelectedBlockIcon className="size-6 text-[var(--ink)]" />
          ) : null}
          <h2 className="font-display text-2xl text-[var(--ink)]">
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
            <p className="text-xs text-[var(--muted)]">
              {t("builder.markdownHelp")}
            </p>
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
            <p className="text-xs text-[var(--muted)]">
              {t("builder.markdownHelp")}
            </p>
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

        {blockDraft.type === "RATING" ? (
          <div className="grid gap-5 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-4 text-sm text-[var(--muted)]">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {t("builder.ratingMin")}
                </span>
                <Select
                  value={String((blockDraft.config as RatingBlockConfig).min)}
                  onValueChange={(value) =>
                    updateConfig({ min: Number(value) })
                  }
                >
                  <SelectTrigger
                    aria-label={t("builder.ratingMin")}
                    className="h-11 px-4 text-sm font-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_MIN_VALUES.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {t("builder.ratingMax")}
                </span>
                <Select
                  value={String((blockDraft.config as RatingBlockConfig).max)}
                  onValueChange={(value) =>
                    updateConfig({ max: Number(value) })
                  }
                >
                  <SelectTrigger
                    aria-label={t("builder.ratingMax")}
                    className="h-11 px-4 text-sm font-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_MAX_VALUES.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {t("builder.ratingMinLabel")}
                </span>
                <Input
                  maxLength={40}
                  value={(blockDraft.config as RatingBlockConfig).minLabel}
                  onChange={(event) =>
                    updateConfig({ minLabel: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {t("builder.ratingMaxLabel")}
                </span>
                <Input
                  maxLength={40}
                  value={(blockDraft.config as RatingBlockConfig).maxLabel}
                  onChange={(event) =>
                    updateConfig({ maxLabel: event.target.value })
                  }
                />
              </label>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {t("builder.ratingHelp")}
            </p>
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
          </div>
        )}

        <BranchRulesEditor
          allBlocks={allBlocks}
          blockDraft={blockDraft}
          branchRulesDraft={branchRulesDraft}
          branchValidationIssues={branchValidationIssues}
          setBranchRulesDraft={setBranchRulesDraft}
          updateConfig={updateConfig}
        />
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
