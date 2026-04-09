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
  GripVertical,
  LoaderCircle,
  Radio,
  Rows3,
  SquareCheck,
  TextCursorInput,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  BlockEditorPanel,
  BuilderHeader,
  EmptyEditorState,
  FormSettingsPanel,
  type FormMetadataDraft,
} from "@/components/form-builder-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToastViewport, type ToastData } from "@/components/ui/toast";
import { blockTypeLabels, getBlockPreview, type ChoiceBlockConfig } from "@/lib/blocks";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";
import { cn } from "@/lib/utils";

type BlockType = BuilderBlock["type"];

type Selection = { kind: "form" } | { kind: "block"; blockId: string };

const blockIcons: Record<BlockType, typeof Type> = {
  TEXT: Type,
  SHORT_TEXT: TextCursorInput,
  LONG_TEXT: Rows3,
  SINGLE_CHOICE: Radio,
  MULTIPLE_CHOICE: SquareCheck,
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
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em]">{blockTypeLabels[block.type]}</span>
          </div>
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--line-strong)] bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-ink)]">
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
        selected
          ? "border-[var(--accent)] bg-[var(--surface-strong)] shadow-[var(--shadow-elevated)]"
          : "border-[color:var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]",
      )}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <button
            className="rounded-full border border-[color:var(--line)] p-1.5 text-[var(--muted)] transition hover:bg-[var(--accent-soft)]"
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
        selected
          ? "border-[var(--accent)] bg-[var(--surface-strong)] shadow-[var(--shadow-elevated)]"
          : "border-[color:var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]",
      )}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <div className="rounded-full border border-[color:var(--line)] p-1.5 text-[var(--muted)]">
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

  const [metadataDraft, setMetadataDraft] = useState<FormMetadataDraft>({
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
      ? (selectedBlock.config as ChoiceBlockConfig).options.join("\n")
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
        ? (selectedBlock.config as ChoiceBlockConfig).options.join("\n")
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
      showToast(`Added ${blockTypeLabels[type].toLowerCase()}`);
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
        <BuilderHeader
          form={form}
          settingsSelected={selection.kind === "form"}
          busy={busy}
          onOpenSettings={() => setSelection({ kind: "form" })}
          onTogglePublished={togglePublished}
        />

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

          <div className="mt-6 space-y-3 border-t border-[color:var(--line)] pt-6">
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
                    {blockTypeLabels[type]}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:p-8">
          {selection.kind === "form" ? (
            <FormSettingsPanel
              metadataDraft={metadataDraft}
              setMetadataDraft={setMetadataDraft}
              shareHref={shareHref}
              copyShareLink={copyShareLink}
              deleteForm={deleteForm}
              saveMetadata={saveMetadata}
              busy={busy}
            />
          ) : blockDraft ? (
            <BlockEditorPanel
              blockDraft={blockDraft}
              selectedBlockIcon={SelectedBlockIcon}
              choiceOptionsDraft={choiceOptionsDraft}
              setChoiceOptionsDraft={setChoiceOptionsDraft}
              setBlockDraft={setBlockDraft}
              deleteBlock={deleteBlock}
              saveBlock={saveBlock}
              busy={busy}
            />
          ) : (
            <EmptyEditorState onAddShortText={() => addBlock("SHORT_TEXT")} />
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
