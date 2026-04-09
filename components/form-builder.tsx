"use client";

import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripVertical,
  Link as LinkIcon,
  LoaderCircle,
  Plus,
  MessagesSquare,
  Radio,
  Rows3,
  Save,
  Settings2,
  SquareCheck,
  TextCursorInput,
  Trash2,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToastViewport, type ToastData } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BlockType = "TEXT" | "SHORT_TEXT" | "LONG_TEXT" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE";

type TextConfig = { body: string };
type PlaceholderConfig = { placeholder: string };
type ChoiceConfig = { options: string[] };

type BuilderBlock = {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  required: boolean;
  position: number;
  config: TextConfig | PlaceholderConfig | ChoiceConfig;
};

type BuilderForm = {
  id: string;
  title: string;
  description: string;
  completionTitle: string;
  completionMessage: string;
  completionLinkLabel: string | null;
  completionLinkUrl: string | null;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
  responseCount: number;
  blocks: BuilderBlock[];
};

type Selection = { kind: "form" } | { kind: "block"; blockId: string };

const blockIcons: Record<BlockType, typeof Type> = {
  TEXT: Type,
  SHORT_TEXT: TextCursorInput,
  LONG_TEXT: Rows3,
  SINGLE_CHOICE: Radio,
  MULTIPLE_CHOICE: SquareCheck,
};

const blockLabels: Record<BlockType, string> = {
  TEXT: "Text block",
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
};

const blockCreationOrder: BlockType[] = ["TEXT", "SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTIPLE_CHOICE"];

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function getBlockPreview(block: BuilderBlock) {
  if (block.title.trim()) {
    return block.title;
  }

  if (block.type === "TEXT") {
    return (block.config as TextConfig).body;
  }

  if ("placeholder" in block.config) {
    return block.config.placeholder;
  }

  if ("options" in block.config) {
    return block.config.options.join(" • ");
  }

  return blockLabels[block.type];
}

function isQuestion(type: BlockType) {
  return type !== "TEXT";
}

function BlockRowInner({
  block,
  onSelect,
  dragHandle,
}: {
  block: BuilderBlock;
  onSelect: (blockId: string) => void;
  dragHandle: React.ReactNode;
}) {
  const Icon = blockIcons[block.type];

  return (
    <>
      {dragHandle}
      <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onSelect(block.id)}>
        <div className="flex items-center justify-between gap-2 text-[var(--muted)]">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em]">{blockLabels[block.type]}</span>
          </div>
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-strong)] text-[10px] font-semibold text-[var(--ink)]">
            {block.position + 1}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">{getBlockPreview(block)}</p>
      </button>
    </>
  );
}

function SortableBlockRow({
  block,
  selected,
  onSelect,
}: {
  block: BuilderBlock;
  selected: boolean;
  onSelect: (blockId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group flex items-center gap-2.5 rounded-[16px] border px-3 py-3 transition",
        selected ? "border-[var(--accent)] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]" : "border-black/8 bg-white/65 hover:bg-white",
      )}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <button
            className="rounded-full border border-black/8 p-1.5 text-[var(--muted)] transition hover:bg-black/5"
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        }
      />
    </div>
  );
}

function StaticBlockRow({
  block,
  selected,
  onSelect,
}: {
  block: BuilderBlock;
  selected: boolean;
  onSelect: (blockId: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-[16px] border px-3 py-3 transition",
        selected ? "border-[var(--accent)] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]" : "border-black/8 bg-white/65 hover:bg-white",
      )}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <div className="rounded-full border border-black/8 p-1.5 text-[var(--muted)]">
            <GripVertical className="size-3.5" />
          </div>
        }
      />
    </div>
  );
}

export function FormBuilder({ initialForm }: { initialForm: BuilderForm }) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [selection, setSelection] = useState<Selection>(() =>
    initialForm.blocks[0] ? { kind: "block", blockId: initialForm.blocks[0].id } : { kind: "form" },
  );
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [isDndReady, setIsDndReady] = useState(false);

  const [metadataDraft, setMetadataDraft] = useState({
    title: initialForm.title,
    description: initialForm.description,
    completionTitle: initialForm.completionTitle,
    completionMessage: initialForm.completionMessage,
    completionLinkLabel: initialForm.completionLinkLabel ?? "",
    completionLinkUrl: initialForm.completionLinkUrl ?? "",
    slug: initialForm.slug,
  });

  const selectedBlock = useMemo(
    () => (selection.kind === "block" ? form.blocks.find((block) => block.id === selection.blockId) ?? null : null),
    [form.blocks, selection],
  );

  const [blockDraft, setBlockDraft] = useState<BuilderBlock | null>(selectedBlock);
  const [choiceOptionsDraft, setChoiceOptionsDraft] = useState(
    selectedBlock && (selectedBlock.type === "SINGLE_CHOICE" || selectedBlock.type === "MULTIPLE_CHOICE")
      ? (selectedBlock.config as ChoiceConfig).options.join("\n")
      : "",
  );
  const SelectedBlockIcon = blockDraft ? blockIcons[blockDraft.type] : null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    setMetadataDraft({
      title: form.title,
      description: form.description,
      completionTitle: form.completionTitle,
      completionMessage: form.completionMessage,
      completionLinkLabel: form.completionLinkLabel ?? "",
      completionLinkUrl: form.completionLinkUrl ?? "",
      slug: form.slug,
    });
  }, [form.title, form.description, form.completionTitle, form.completionMessage, form.completionLinkLabel, form.completionLinkUrl, form.slug]);

  useEffect(() => {
    setBlockDraft(selectedBlock);
    setChoiceOptionsDraft(
      selectedBlock && (selectedBlock.type === "SINGLE_CHOICE" || selectedBlock.type === "MULTIPLE_CHOICE")
        ? (selectedBlock.config as ChoiceConfig).options.join("\n")
        : "",
    );
  }, [selectedBlock]);

  useEffect(() => {
    setIsDndReady(true);
  }, []);

  function showToast(message: string, variant: ToastData["variant"] = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, variant }]);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  async function withTask(task: string, runner: () => Promise<void>) {
    setBusy(task);

    try {
      await runner();
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError.message : "Something went wrong.";
      showToast(nextError, "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveMetadata() {
    await withTask("metadata", async () => {
      const payload = await fetchJson<{ form: BuilderForm }>(`/api/forms/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify(metadataDraft),
      });

      setForm(payload.form);
      showToast("Saved form settings");
    });
  }

  async function addBlock(type: BlockType) {
    await withTask(`add-${type}`, async () => {
      const payload = await fetchJson<{ block: BuilderBlock }>(`/api/forms/${form.id}/blocks`, {
        method: "POST",
        body: JSON.stringify({ type }),
      });

      setForm((current) => ({
        ...current,
        blocks: [...current.blocks, payload.block],
      }));
      setSelection({ kind: "block", blockId: payload.block.id });
      showToast(`Added ${blockLabels[type].toLowerCase()}`);
    });
  }

  async function saveBlock() {
    if (!blockDraft) {
      return;
    }

    await withTask(`block-${blockDraft.id}`, async () => {
      const payload = await fetchJson<{ block: BuilderBlock }>(`/api/forms/${form.id}/blocks/${blockDraft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: blockDraft.title,
          description: blockDraft.description,
          required: blockDraft.required,
          config:
            blockDraft.type === "SINGLE_CHOICE" || blockDraft.type === "MULTIPLE_CHOICE"
              ? { options: choiceOptionsDraft.split("\n") }
              : blockDraft.config,
        }),
      });

      setForm((current) => ({
        ...current,
        blocks: current.blocks.map((block) => (block.id === payload.block.id ? payload.block : block)),
      }));
      showToast("Saved block");
    });
  }

  async function deleteBlock(blockId: string) {
    await withTask(`delete-${blockId}`, async () => {
      await fetchJson(`/api/forms/${form.id}/blocks/${blockId}`, {
        method: "DELETE",
      });

      setForm((current) => ({
        ...current,
        blocks: current.blocks
          .filter((block) => block.id !== blockId)
          .map((block, index) => ({
            ...block,
            position: index,
          })),
      }));
      setSelection({ kind: "form" });
      showToast("Removed block");
    });
  }

  async function togglePublished() {
    await withTask("publish", async () => {
      const payload = await fetchJson<{ form: BuilderForm }>(`/api/forms/${form.id}/publish`, {
        method: "POST",
        body: JSON.stringify({
          published: form.status !== "PUBLISHED",
        }),
      });

      setForm(payload.form);
      showToast(payload.form.status === "PUBLISHED" ? "Form published" : "Form moved back to draft");
      router.refresh();
    });
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/f/${form.slug}`;
    await navigator.clipboard.writeText(url);
    showToast("Copied share link");
  }

  async function deleteForm() {
    const confirmed = window.confirm(
      "Delete this form permanently? This will also delete all blocks and responses. This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    await withTask("delete-form", async () => {
      await fetchJson(`/api/forms/${form.id}`, {
        method: "DELETE",
      });

      router.push("/dashboard");
      router.refresh();
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const previous = form.blocks;
    const oldIndex = previous.findIndex((block) => block.id === active.id);
    const newIndex = previous.findIndex((block) => block.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = arrayMove(previous, oldIndex, newIndex).map((block, index) => ({ ...block, position: index }));
    setForm((current) => ({ ...current, blocks: reordered }));

    try {
      const payload = await fetchJson<{ form: BuilderForm }>(`/api/forms/${form.id}/blocks/reorder`, {
        method: "POST",
        body: JSON.stringify({ blockIds: reordered.map((block) => block.id) }),
      });

      setForm(payload.form);
      showToast("Updated block order");
    } catch (caughtError) {
      setForm((current) => ({ ...current, blocks: previous }));
      showToast(caughtError instanceof Error ? caughtError.message : "Could not reorder blocks.", "error");
    }
  }

  const shareHref = `/f/${form.slug}`;

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <section className="flex flex-col gap-4 border-b border-black/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Builder</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl text-[var(--ink)]">{form.title}</h1>
            <Badge className={cn("rounded-full", form.status === "PUBLISHED" && "bg-[var(--accent-soft)] text-[#2f5d35]")}>{form.status}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Edit blocks, update settings, and review responses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <Button
            variant={selection.kind === "form" ? "default" : "secondary"}
            onClick={() => setSelection({ kind: "form" })}
          >
            <Settings2 className="size-4" />
            Settings
          </Button>
          <Link href={`/forms/${form.id}/responses`}>
            <Button variant="secondary">
              <MessagesSquare className="size-4" />
              Responses ({form.responseCount})
            </Button>
          </Link>
          <Button variant={form.status === "PUBLISHED" ? "secondary" : "default"} onClick={togglePublished}>
            {busy === "publish" ? <LoaderCircle className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
            {form.status === "PUBLISHED" ? "Unpublish" : "Publish form"}
          </Button>
        </div>
      </section>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl text-[var(--ink)]">Blocks</h2>
            <Badge>{form.blocks.length} steps</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {isDndReady ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={form.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                  {form.blocks.map((block) => (
                    <SortableBlockRow
                      key={block.id}
                      block={block}
                      selected={selection.kind === "block" && selection.blockId === block.id}
                      onSelect={(blockId) => setSelection({ kind: "block", blockId })}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              form.blocks.map((block) => (
                <StaticBlockRow
                  key={block.id}
                  block={block}
                  selected={selection.kind === "block" && selection.blockId === block.id}
                  onSelect={(blockId) => setSelection({ kind: "block", blockId })}
                />
              ))
            )}
          </div>

          <div className="mt-6 space-y-3 border-t border-black/8 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Add block</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {blockCreationOrder.map((type) => {
                const Icon = blockIcons[type];

                return (
                  <Button
                    key={type}
                    variant="secondary"
                    size="sm"
                    className="justify-start"
                    onClick={() => addBlock(type)}
                  >
                    {busy === `add-${type}` ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />}
                    {blockLabels[type]}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          {selection.kind === "form" ? (
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
                  <Textarea
                    value={metadataDraft.description}
                    onChange={(event) => setMetadataDraft((current) => ({ ...current, description: event.target.value }))}
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--muted)]">
                  <span className="font-medium text-[var(--ink)]">Share URL slug</span>
                  <Input
                    value={metadataDraft.slug}
                    className="font-mono text-[13px]"
                    onChange={(event) => setMetadataDraft((current) => ({ ...current, slug: event.target.value }))}
                  />
                </label>
              </div>

              <div className="space-y-5 border-t border-black/8 pt-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">After submission</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Customize what respondents see after they finish the form, including an optional next-step link.
                  </p>
                </div>

                <div className="grid gap-5">
                  <label className="space-y-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--ink)]">Completion title</span>
                    <Input
                      value={metadataDraft.completionTitle}
                      onChange={(event) => setMetadataDraft((current) => ({ ...current, completionTitle: event.target.value }))}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--ink)]">Completion message</span>
                    <Textarea
                      value={metadataDraft.completionMessage}
                      onChange={(event) => setMetadataDraft((current) => ({ ...current, completionMessage: event.target.value }))}
                    />
                  </label>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <label className="space-y-2 text-sm text-[var(--muted)]">
                      <span className="font-medium text-[var(--ink)]">Follow-up link label</span>
                      <Input
                        value={metadataDraft.completionLinkLabel}
                        placeholder="Read next steps"
                        onChange={(event) => setMetadataDraft((current) => ({ ...current, completionLinkLabel: event.target.value }))}
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--muted)]">
                      <span className="font-medium text-[var(--ink)]">Follow-up link URL</span>
                      <Input
                        value={metadataDraft.completionLinkUrl}
                        placeholder="https://example.com/next"
                        onChange={(event) => setMetadataDraft((current) => ({ ...current, completionLinkUrl: event.target.value }))}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-[20px] border border-black/8 bg-[var(--bg-strong)] p-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-6">
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
          ) : blockDraft ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {SelectedBlockIcon ? <SelectedBlockIcon className="size-6 text-[var(--ink)]" /> : null}
                  <h2 className="font-display text-4xl text-[var(--ink)]">{blockLabels[blockDraft.type]}</h2>
                </div>
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--bg-strong)] text-sm font-semibold text-[var(--ink)]">
                  {blockDraft.position + 1}
                </span>
              </div>

              <div className="grid gap-5">
                <label className="space-y-2 text-sm text-[var(--muted)]">
                  <span className="font-medium text-[var(--ink)]">Prompt</span>
                  <Input
                    value={blockDraft.title}
                    onChange={(event) => setBlockDraft((current) => (current ? { ...current, title: event.target.value } : current))}
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--muted)]">
                  <span className="font-medium text-[var(--ink)]">Support text</span>
                  <Textarea
                    value={blockDraft.description}
                    onChange={(event) => setBlockDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                  />
                </label>

                {blockDraft.type === "TEXT" ? (
                  <label className="space-y-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--ink)]">Body copy</span>
                    <Textarea
                      value={(blockDraft.config as TextConfig).body}
                      onChange={(event) =>
                        setBlockDraft((current) =>
                          current ? { ...current, config: { body: event.target.value } } : current,
                        )
                      }
                    />
                  </label>
                ) : null}

                {(blockDraft.type === "SHORT_TEXT" || blockDraft.type === "LONG_TEXT") && (
                  <label className="space-y-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--ink)]">Placeholder</span>
                    <Input
                      value={(blockDraft.config as PlaceholderConfig).placeholder}
                      onChange={(event) =>
                        setBlockDraft((current) =>
                          current ? { ...current, config: { placeholder: event.target.value } } : current,
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
                                config: {
                                  options: event.target.value.split("\n"),
                                },
                              }
                            : current,
                        );
                      }}
                    />
                    <p className="text-xs text-[var(--muted)]">Use one option per line. We’ll keep the first 10 non-empty values.</p>
                  </label>
                )}

                {isQuestion(blockDraft.type) ? (
                  <label className="flex items-center gap-3 rounded-xl border border-black/8 bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]">
                    <input
                      checked={blockDraft.required}
                      className="size-4 rounded border-black/15"
                      type="checkbox"
                      onChange={(event) =>
                        setBlockDraft((current) => (current ? { ...current, required: event.target.checked } : current))
                      }
                    />
                    Mark this question as required
                  </label>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-6">
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
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-[20px] border border-dashed border-black/10 bg-[var(--bg-strong)] p-10 text-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Nothing selected</p>
                <h2 className="mt-4 font-display text-4xl text-[var(--ink)]">Select a block or open form settings.</h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
                  Use the left panel to choose what you want to edit.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button variant="secondary" onClick={() => addBlock("SHORT_TEXT")}>
                    <Plus className="size-4" />
                    Add a short text question
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
