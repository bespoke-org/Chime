"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Link as LinkIcon, LoaderCircle, MessagesSquare, Plus, Save, Settings2, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";

import { useI18n } from "@/components/i18n-provider";
import { FormStatusBadge } from "@/components/form-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  blockTypeTranslationKeys,
  isQuestionBlock,
  type BlockConfig,
  type LongTextBlockConfig,
  type ShortTextBlockConfig,
  type TextBlockConfig,
} from "@/lib/blocks";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";

export type FormMetadataDraft = {
  title: string;
  description: string;
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

export function BuilderHeader({
  form,
  settingsSelected,
  busy,
  onOpenSettings,
  onTogglePublished,
}: {
  form: BuilderForm;
  settingsSelected: boolean;
  busy: string | null;
  onOpenSettings: () => void;
  onTogglePublished: () => void;
}) {
  const { t } = useI18n();
  const workspaceLabel = form.workspace.kind === "personal" ? t("workspace.personal") : form.workspace.label;

  return (
    <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-[var(--ink)]">{form.title}</h1>
          <FormStatusBadge status={form.status} />
        </div>
        <p className="mt-2 text-xs font-medium uppercase text-[var(--muted)]">{workspaceLabel}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("builder.description")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <Button variant={settingsSelected ? "default" : "secondary"} onClick={onOpenSettings}>
          <Settings2 className="size-4" />
          {t("builder.settings")}
        </Button>
        <Link href={`/forms/${form.id}/responses`}>
          <Button variant="secondary">
            <MessagesSquare className="size-4" />
            {t("builder.responses", { count: form.responseCount })}
          </Button>
        </Link>
        <Button variant={form.status === "PUBLISHED" ? "secondary" : "default"} onClick={onTogglePublished}>
          {busy === "publish" ? <LoaderCircle className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
          {form.status === "PUBLISHED" ? t("builder.unpublish") : t("builder.publish")}
        </Button>
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
        <h2 className="font-display text-4xl text-[var(--ink)]">{t("builder.settingsTitle")}</h2>
      </div>

      <div className="grid gap-5">
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">{t("builder.titleField")}</span>
          <Input value={metadataDraft.title} onChange={(event) => setMetadataDraft((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">{t("builder.descriptionField")}</span>
          <Textarea value={metadataDraft.description} onChange={(event) => setMetadataDraft((current) => ({ ...current, description: event.target.value }))} />
        </label>
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">{t("builder.shareSlug")}</span>
          <Input value={metadataDraft.slug} className="font-mono text-[13px]" onChange={(event) => setMetadataDraft((current) => ({ ...current, slug: event.target.value }))} />
        </label>
      </div>

      <div className="space-y-5 border-t border-[color:var(--line)] pt-6">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">{t("builder.afterSubmission")}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t("builder.afterSubmissionDescription")}
          </p>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">{t("builder.completionTitle")}</span>
            <Input value={metadataDraft.completionTitle} onChange={(event) => setMetadataDraft((current) => ({ ...current, completionTitle: event.target.value }))} />
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">{t("builder.completionMessage")}</span>
            <Textarea value={metadataDraft.completionMessage} onChange={(event) => setMetadataDraft((current) => ({ ...current, completionMessage: event.target.value }))} />
          </label>
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">{t("builder.followUpLabel")}</span>
              <Input value={metadataDraft.completionLinkLabel} placeholder={t("builder.followUpLabelPlaceholder")} onChange={(event) => setMetadataDraft((current) => ({ ...current, completionLinkLabel: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">{t("builder.followUpUrl")}</span>
              <Input value={metadataDraft.completionLinkUrl} placeholder={t("builder.followUpUrlPlaceholder")} onChange={(event) => setMetadataDraft((current) => ({ ...current, completionLinkUrl: event.target.value }))} />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-[color:var(--line)] pt-6 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">{t("builder.publicRoute")}</p>
          <p className="mt-2 truncate font-mono text-[13px] text-[var(--ink)]">{shareHref}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("builder.publicRouteHelp")}
          </p>
        </div>
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-6">
        <Button variant="danger" onClick={deleteForm}>
          {busy === "delete-form" ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          {t("builder.deleteForm")}
        </Button>
        <Button onClick={saveMetadata}>
          {busy === "metadata" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: option.id });

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
      <Input value={option.value} placeholder={t("builder.option", { number: index + 1 })} onChange={(event) => onChange(option.id, event.target.value)} />
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
  blockDraft,
  selectedBlockIcon: SelectedBlockIcon,
  choiceOptionsDraft,
  setChoiceOptionsDraft,
  setBlockDraft,
  deleteBlock,
  saveBlock,
  busy,
}: {
  blockDraft: BuilderBlock;
  selectedBlockIcon: LucideIcon | null;
  choiceOptionsDraft: ChoiceOptionDraft[];
  setChoiceOptionsDraft: Dispatch<SetStateAction<ChoiceOptionDraft[]>>;
  setBlockDraft: Dispatch<SetStateAction<BuilderBlock | null>>;
  deleteBlock: (blockId: string) => void;
  saveBlock: () => void;
  busy: string | null;
}) {
  const { t } = useI18n();
  const optionSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function syncChoiceOptions(nextOptions: ChoiceOptionDraft[]) {
    setChoiceOptionsDraft(nextOptions);
    setBlockDraft((current) =>
      current
        ? {
            ...current,
            config: { options: nextOptions.map((option) => option.value) } as BlockConfig,
          }
        : current,
    );
  }

  function updateChoiceOption(optionId: string, value: string) {
    syncChoiceOptions(choiceOptionsDraft.map((option) => (option.id === optionId ? { ...option, value } : option)));
  }

  function addChoiceOption() {
    if (choiceOptionsDraft.length >= 10) {
      return;
    }

    syncChoiceOptions([...choiceOptionsDraft, { id: crypto.randomUUID(), value: t("builder.option", { number: choiceOptionsDraft.length + 1 }) }]);
  }

  function removeChoiceOption(optionId: string) {
    if (choiceOptionsDraft.length <= 2) {
      return;
    }

    syncChoiceOptions(choiceOptionsDraft.filter((option) => option.id !== optionId));
  }

  function handleChoiceOptionDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = choiceOptionsDraft.findIndex((option) => option.id === active.id);
    const newIndex = choiceOptionsDraft.findIndex((option) => option.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    syncChoiceOptions(arrayMove(choiceOptionsDraft, oldIndex, newIndex));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-3">
          {SelectedBlockIcon ? <SelectedBlockIcon className="size-6 text-[var(--ink)]" /> : null}
          <h2 className="font-display text-4xl text-[var(--ink)]">{t(blockTypeTranslationKeys[blockDraft.type])}</h2>
        </div>
      </div>

      <div className="grid gap-5">
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">{t("builder.prompt")}</span>
          <Input value={blockDraft.title} onChange={(event) => setBlockDraft((current) => (current ? { ...current, title: event.target.value } : current))} />
        </label>
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">{t("builder.supportText")}</span>
          <Textarea value={blockDraft.description} onChange={(event) => setBlockDraft((current) => (current ? { ...current, description: event.target.value } : current))} />
        </label>

        {blockDraft.type === "TEXT" ? (
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">{t("builder.bodyCopy")}</span>
            <Textarea
              value={(blockDraft.config as TextBlockConfig).body}
              onChange={(event) => setBlockDraft((current) => (current ? { ...current, config: { body: event.target.value } as BlockConfig } : current))}
            />
          </label>
        ) : null}

        {(blockDraft.type === "SHORT_TEXT" || blockDraft.type === "LONG_TEXT") && (
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">{t("builder.placeholder")}</span>
            <Input
              value={blockDraft.type === "SHORT_TEXT" ? (blockDraft.config as ShortTextBlockConfig).placeholder : (blockDraft.config as LongTextBlockConfig).placeholder}
              onChange={(event) =>
                setBlockDraft((current) =>
                  current ? { ...current, config: { placeholder: event.target.value } as BlockConfig } : current,
                )
              }
            />
          </label>
        )}

        {(blockDraft.type === "SINGLE_CHOICE" || blockDraft.type === "MULTIPLE_CHOICE") && (
          <div className="grid gap-3 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-[var(--ink)]">{t("builder.choiceOptions")}</span>
              <Button variant="secondary" size="sm" onClick={addChoiceOption} disabled={choiceOptionsDraft.length >= 10}>
                <Plus className="size-4" />
                {t("builder.addOption")}
              </Button>
            </div>
            <DndContext sensors={optionSensors} collisionDetection={closestCenter} onDragEnd={handleChoiceOptionDragEnd}>
              <SortableContext items={choiceOptionsDraft.map((option) => option.id)} strategy={verticalListSortingStrategy}>
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
            <p className="text-xs text-[var(--muted)]">{t("builder.optionsHelp")}</p>
          </div>
        )}

        {isQuestionBlock(blockDraft.type) ? (
          <label className="flex items-center gap-3 rounded-xl bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]">
            <input
              checked={blockDraft.required}
              className="size-4 rounded border-[color:var(--line-strong)]"
              type="checkbox"
              onChange={(event) => setBlockDraft((current) => (current ? { ...current, required: event.target.checked } : current))}
            />
            {t("builder.requiredToggle")}
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-6">
        <Button variant="danger" onClick={() => deleteBlock(blockDraft.id)}>
          {busy === `delete-${blockDraft.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          {t("builder.deleteBlock")}
        </Button>
        <Button onClick={saveBlock}>
          {busy === `block-${blockDraft.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("builder.saveBlock")}
        </Button>
      </div>
    </div>
  );
}

export function EmptyEditorState({ onAddShortText }: { onAddShortText: () => void }) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[420px] items-center justify-center border-t border-dashed border-[color:var(--line)] p-10 text-center">
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--accent)]">{t("builder.nothingSelected")}</p>
        <h2 className="mt-4 font-display text-4xl text-[var(--ink)]">{t("builder.nothingSelectedTitle")}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">{t("builder.nothingSelectedDescription")}</p>
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
