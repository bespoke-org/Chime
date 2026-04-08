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
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <Icon className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.22em]">{blockLabels[block.type]}</span>
        </div>
        <p className="mt-2 truncate font-medium text-[var(--ink)]">{getBlockPreview(block)}</p>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{block.description || "No helper copy yet"}</p>
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
        "group flex items-start gap-3 rounded-[22px] border px-4 py-4 transition",
        selected ? "border-[var(--accent)] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]" : "border-black/8 bg-white/65 hover:bg-white",
      )}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <button
            className="mt-1 rounded-full border border-black/8 p-2 text-[var(--muted)] transition hover:bg-black/5"
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
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
        "group flex items-start gap-3 rounded-[22px] border px-4 py-4 transition",
        selected ? "border-[var(--accent)] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]" : "border-black/8 bg-white/65 hover:bg-white",
      )}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <div className="mt-1 rounded-full border border-black/8 p-2 text-[var(--muted)]">
            <GripVertical className="size-4" />
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isDndReady, setIsDndReady] = useState(false);

  const [metadataDraft, setMetadataDraft] = useState({
    title: initialForm.title,
    description: initialForm.description,
    slug: initialForm.slug,
  });

  const selectedBlock = useMemo(
    () => (selection.kind === "block" ? form.blocks.find((block) => block.id === selection.blockId) ?? null : null),
    [form.blocks, selection],
  );

  const [blockDraft, setBlockDraft] = useState<BuilderBlock | null>(selectedBlock);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    setMetadataDraft({
      title: form.title,
      description: form.description,
      slug: form.slug,
    });
  }, [form.title, form.description, form.slug]);

  useEffect(() => {
    setBlockDraft(selectedBlock);
  }, [selectedBlock]);

  useEffect(() => {
    setIsDndReady(true);
  }, []);

  async function withTask(task: string, runner: () => Promise<void>) {
    setBusy(task);
    setError(null);

    try {
      await runner();
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError.message : "Something went wrong.";
      setError(nextError);
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
      setMessage("Form settings saved.");
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
      setMessage(`${blockLabels[type]} added.`);
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
          config: blockDraft.config,
        }),
      });

      setForm((current) => ({
        ...current,
        blocks: current.blocks.map((block) => (block.id === payload.block.id ? payload.block : block)),
      }));
      setMessage("Block saved.");
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
      setMessage("Block removed.");
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
      setMessage(payload.form.status === "PUBLISHED" ? "Form published." : "Form moved back to draft.");
      router.refresh();
    });
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/f/${form.slug}`;
    await navigator.clipboard.writeText(url);
    setMessage("Share link copied.");
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
      setMessage("Block order updated.");
    } catch (caughtError) {
      setForm((current) => ({ ...current, blocks: previous }));
      setError(caughtError instanceof Error ? caughtError.message : "Could not reorder blocks.");
    }
  }

  const shareHref = `/f/${form.slug}`;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[30px] border border-black/8 bg-white/70 px-6 py-5 backdrop-blur-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Builder</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">{form.title}</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Left: structure and flow. Right: the selected block or form settings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={cn(form.status === "PUBLISHED" && "bg-[var(--accent-soft)] text-[#2f5d35]")}>{form.status}</Badge>
          <Link href={`/forms/${form.id}/responses`}>
            <Button variant="secondary">Responses ({form.responseCount})</Button>
          </Link>
          <Button variant={form.status === "PUBLISHED" ? "secondary" : "default"} onClick={togglePublished}>
            {busy === "publish" ? <LoaderCircle className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
            {form.status === "PUBLISHED" ? "Unpublish" : "Publish form"}
          </Button>
        </div>
      </section>

      {(message || error) && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-[#cfe9d0] bg-[#eef9ef] text-[#2f5d35]",
          )}
        >
          {error ?? message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Flow</p>
              <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">Blocks</h2>
            </div>
            <Badge>{form.blocks.length} steps</Badge>
          </div>

          <button
            type="button"
            onClick={() => setSelection({ kind: "form" })}
            className={cn(
              "mt-5 flex w-full items-center gap-3 rounded-[22px] border px-4 py-4 text-left transition",
              selection.kind === "form" ? "border-[var(--accent)] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]" : "border-black/8 bg-white/60 hover:bg-white",
            )}
          >
            <div className="rounded-full border border-black/8 p-2 text-[var(--muted)]">
              <Settings2 className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Form settings</p>
              <p className="mt-1 font-medium text-[var(--ink)]">Title, slug, publish state</p>
            </div>
          </button>

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
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Form settings</p>
                <h2 className="mt-3 font-display text-4xl text-[var(--ink)]">Shape the live version.</h2>
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
                  <Input value={metadataDraft.slug} onChange={(event) => setMetadataDraft((current) => ({ ...current, slug: event.target.value }))} />
                </label>
              </div>

              <div className="grid gap-4 rounded-[28px] border border-black/8 bg-[var(--bg-strong)] p-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Public route</p>
                  <p className="mt-2 truncate text-sm text-[var(--ink)]">{shareHref}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Only published forms accept anonymous submissions. Editing a published form updates the live experience.
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

              <div className="flex justify-end">
                <Button onClick={saveMetadata}>
                  {busy === "metadata" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save form settings
                </Button>
              </div>
            </div>
          ) : blockDraft ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Selected block</p>
                  <h2 className="mt-3 font-display text-4xl text-[var(--ink)]">{blockLabels[blockDraft.type]}</h2>
                </div>
                <Badge>{blockDraft.position + 1}</Badge>
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
                      value={(blockDraft.config as ChoiceConfig).options.join("\n")}
                      onChange={(event) =>
                        setBlockDraft((current) =>
                          current
                            ? {
                                ...current,
                                config: {
                                  options: event.target.value
                                    .split("\n")
                                    .map((option) => option.trim())
                                    .filter(Boolean),
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <p className="text-xs text-[var(--muted)]">Use one option per line. We’ll keep the first 10 non-empty values.</p>
                  </label>
                )}

                {isQuestion(blockDraft.type) ? (
                  <label className="flex items-center gap-3 rounded-2xl border border-black/8 bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]">
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
            <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-[var(--bg-strong)] p-10 text-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Nothing selected</p>
                <h2 className="mt-4 font-display text-4xl text-[var(--ink)]">Pick a block or open form settings.</h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
                  The builder stays intentionally simple in v0: organize the flow on the left, edit the selected step on the right.
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
  );
}
