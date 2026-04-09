import { Copy, Link as LinkIcon, LoaderCircle, MessagesSquare, Plus, Save, Settings2, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";

import { FormStatusBadge } from "@/components/form-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  blockTypeLabels,
  isQuestionBlock,
  type BlockConfig,
  type ChoiceBlockConfig,
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
  return (
    <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Builder</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-[var(--ink)]">{form.title}</h1>
          <FormStatusBadge status={form.status} />
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Edit blocks, update settings, and review responses.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <Button variant={settingsSelected ? "default" : "secondary"} onClick={onOpenSettings}>
          <Settings2 className="size-4" />
          Settings
        </Button>
        <Link href={`/forms/${form.id}/responses`}>
          <Button variant="secondary">
            <MessagesSquare className="size-4" />
            Responses ({form.responseCount})
          </Button>
        </Link>
        <Button variant={form.status === "PUBLISHED" ? "secondary" : "default"} onClick={onTogglePublished}>
          {busy === "publish" ? <LoaderCircle className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
          {form.status === "PUBLISHED" ? "Unpublish" : "Publish form"}
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
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-4xl text-[var(--ink)]">Settings</h2>
      </div>

      <div className="grid gap-5">
        <label className="space-y-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">Title</span>
          <Input value={metadataDraft.title} onChange={(event) => setMetadataDraft((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label className="space-y-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">Description</span>
          <Textarea value={metadataDraft.description} onChange={(event) => setMetadataDraft((current) => ({ ...current, description: event.target.value }))} />
        </label>
        <label className="space-y-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">Share URL slug</span>
          <Input value={metadataDraft.slug} className="font-mono text-[13px]" onChange={(event) => setMetadataDraft((current) => ({ ...current, slug: event.target.value }))} />
        </label>
      </div>

      <div className="space-y-5 border-t border-[color:var(--line)] pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">After submission</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Customize what respondents see after they finish the form, including an optional next-step link.
          </p>
        </div>

        <div className="grid gap-5">
          <label className="space-y-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">Completion title</span>
            <Input value={metadataDraft.completionTitle} onChange={(event) => setMetadataDraft((current) => ({ ...current, completionTitle: event.target.value }))} />
          </label>
          <label className="space-y-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">Completion message</span>
            <Textarea value={metadataDraft.completionMessage} onChange={(event) => setMetadataDraft((current) => ({ ...current, completionMessage: event.target.value }))} />
          </label>
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">Follow-up link label</span>
              <Input value={metadataDraft.completionLinkLabel} placeholder="Read next steps" onChange={(event) => setMetadataDraft((current) => ({ ...current, completionLinkLabel: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">Follow-up link URL</span>
              <Input value={metadataDraft.completionLinkUrl} placeholder="https://example.com/next" onChange={(event) => setMetadataDraft((current) => ({ ...current, completionLinkUrl: event.target.value }))} />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-[20px] border border-[color:var(--line)] bg-[var(--bg-strong)] p-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Public route</p>
          <p className="mt-2 truncate font-mono text-[13px] text-[var(--ink)]">{shareHref}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Published forms accept anonymous submissions. Changes to a published form go live immediately.
          </p>
        </div>
        <Button variant="secondary" onClick={copyShareLink}>
          <Copy className="size-4" />
          Copy link
        </Button>
        <Link href={shareHref} target="_blank">
          <Button variant="secondary">
            <LinkIcon className="size-4" />
            Open runner
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-6">
        <Button variant="danger" onClick={deleteForm}>
          {busy === "delete-form" ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete form
        </Button>
        <Button onClick={saveMetadata}>
          {busy === "metadata" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save form settings
        </Button>
      </div>
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
  choiceOptionsDraft: string;
  setChoiceOptionsDraft: (value: string) => void;
  setBlockDraft: Dispatch<SetStateAction<BuilderBlock | null>>;
  deleteBlock: (blockId: string) => void;
  saveBlock: () => void;
  busy: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {SelectedBlockIcon ? <SelectedBlockIcon className="size-6 text-[var(--ink)]" /> : null}
          <h2 className="font-display text-4xl text-[var(--ink)]">{blockTypeLabels[blockDraft.type]}</h2>
        </div>
        <span className="inline-flex size-8 items-center justify-center rounded-full border border-[color:var(--line-strong)] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-ink)]">
          {blockDraft.position + 1}
        </span>
      </div>

      <div className="grid gap-5">
        <label className="space-y-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">Prompt</span>
          <Input value={blockDraft.title} onChange={(event) => setBlockDraft((current) => (current ? { ...current, title: event.target.value } : current))} />
        </label>
        <label className="space-y-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">Support text</span>
          <Textarea value={blockDraft.description} onChange={(event) => setBlockDraft((current) => (current ? { ...current, description: event.target.value } : current))} />
        </label>

        {blockDraft.type === "TEXT" ? (
          <label className="space-y-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">Body copy</span>
            <Textarea
              value={(blockDraft.config as TextBlockConfig).body}
              onChange={(event) => setBlockDraft((current) => (current ? { ...current, config: { body: event.target.value } as BlockConfig } : current))}
            />
          </label>
        ) : null}

        {(blockDraft.type === "SHORT_TEXT" || blockDraft.type === "LONG_TEXT") && (
          <label className="space-y-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">Placeholder</span>
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
          <label className="space-y-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">Choice options</span>
            <Textarea
              value={choiceOptionsDraft}
              onChange={(event) => {
                setChoiceOptionsDraft(event.target.value);
                setBlockDraft((current) =>
                  current
                    ? {
                        ...current,
                        config: { options: event.target.value.split("\n") } as BlockConfig,
                      }
                    : current,
                );
              }}
            />
            <p className="text-xs text-[var(--muted)]">Use one option per line. We’ll keep the first 10 non-empty values.</p>
          </label>
        )}

        {isQuestionBlock(blockDraft.type) ? (
          <label className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]">
            <input
              checked={blockDraft.required}
              className="size-4 rounded border-[color:var(--line-strong)]"
              type="checkbox"
              onChange={(event) => setBlockDraft((current) => (current ? { ...current, required: event.target.checked } : current))}
            />
            Mark this question as required
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-6">
        <Button variant="danger" onClick={() => deleteBlock(blockDraft.id)}>
          {busy === `delete-${blockDraft.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete block
        </Button>
        <Button onClick={saveBlock}>
          {busy === `block-${blockDraft.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save block
        </Button>
      </div>
    </div>
  );
}

export function EmptyEditorState({ onAddShortText }: { onAddShortText: () => void }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-[20px] border border-dashed border-[color:var(--line)] bg-[var(--bg-strong)] p-10 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Nothing selected</p>
        <h2 className="mt-4 font-display text-4xl text-[var(--ink)]">Select a block or open form settings.</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">Use the left panel to choose what you want to edit.</p>
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={onAddShortText}>
            <Plus className="size-4" />
            Add a short text question
          </Button>
        </div>
      </div>
    </div>
  );
}
