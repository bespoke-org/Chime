"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ArrowLeft,
  GripVertical,
  LoaderCircle,
  PanelRight,
  Plus,
  GitBranch,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  blockCreationOrder,
  blockIcons,
  type BlockType,
} from "@/components/builder/block-creation";
import { BranchingGraphWorkspace } from "@/components/builder/branching-graph-workspace";
import {
  BlockEditorPanel,
  BuilderHeader,
  EmptyEditorState,
  FormSettingsPanel,
  type FormMetadataDraft,
} from "@/components/form-builder-panels";
import { useI18n } from "@/components/i18n-provider";
import { useLocalToasts } from "@/components/use-local-toasts";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { ToastViewport } from "@/components/ui/toast";
import {
  getBranchRules,
  isQuestionBlock,
  blockTypeTranslationKeys,
  getBlockPreview,
  type ChoiceBlockConfig,
} from "@/lib/blocks";
import {
  analyzeBranchingGraph,
  getBranchValidationIssueI18n,
} from "@/lib/branching";
import {
  createBranchRuleDrafts,
  createChoiceOptionDrafts,
  fromDateTimeLocalValue,
  hasBuilderBlockDraftChanges,
  parseMaxResponsesDraft,
  serializeBranchRuleDrafts,
  toDateTimeLocalValue,
  type BranchRuleDraft,
  type ChoiceOptionDraft,
} from "@/lib/form-builder-drafts";
import type { BuilderBlock, BuilderForm } from "@/lib/form-types";
import { cn } from "@/lib/utils";

type BuilderMode = "standard" | "graph";

type Selection = { kind: "form" } | { kind: "block"; blockId: string };
type PendingNavigation =
  | { kind: "form"; nextBuilderMode?: BuilderMode }
  | {
      kind: "block";
      blockId: string;
      graphEdgeId?: string | null;
      nextBuilderMode?: BuilderMode;
      activateGraphSelection?: boolean;
    }
  | { kind: "add-block"; blockType: BlockType; nextBuilderMode?: BuilderMode }
  | {
      kind: "add-block-after";
      blockId: string;
      blockType: BlockType;
      nextBuilderMode?: BuilderMode;
    };

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

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
  const { t } = useI18n();
  const preview = getBlockPreview(
    block,
    t(blockTypeTranslationKeys[block.type]),
  );

  return (
    <>
      {dragHandle}
      <button
        className="min-w-0 flex-1 text-left"
        type="button"
        onClick={() => onSelect(block.id)}
      >
        <div className="min-w-0 flex-1 text-sm font-medium leading-5 text-[var(--ink)]">
          <span className="block truncate">{preview}</span>
        </div>
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
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id });
  const Icon = blockIcons[block.type];
  const preview = getBlockPreview(
    block,
    t(blockTypeTranslationKeys[block.type]),
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-[14px] px-2.5 py-2",
        selected
          ? "bg-[var(--surface-strong)] shadow-[var(--shadow-elevated)]"
          : "hover:bg-[var(--surface)]",
      )}
      onClick={() => onSelect(block.id)}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <button
            className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-[var(--muted)] transition hover:bg-[var(--accent-soft)]"
            type="button"
            aria-label={t("builder.dragBlockAria", { label: preview })}
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <Icon className="size-3 transition group-hover:opacity-0" />
            <GripVertical className="absolute size-3.5 opacity-0 transition group-hover:opacity-100" />
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
  const Icon = blockIcons[block.type];

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-[14px] px-2.5 py-2",
        selected
          ? "bg-[var(--surface-strong)] shadow-[var(--shadow-elevated)]"
          : "hover:bg-[var(--surface)]",
      )}
      onClick={() => onSelect(block.id)}
    >
      <BlockRowInner
        block={block}
        onSelect={onSelect}
        dragHandle={
          <div className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-[var(--muted)]">
            <Icon className="size-3 transition group-hover:opacity-0" />
            <GripVertical className="absolute size-3.5 opacity-0 transition group-hover:opacity-100" />
          </div>
        }
      />
    </div>
  );
}

export function FormBuilder({
  initialForm,
  initialMode = "standard",
  immersiveGraphPage = false,
}: {
  initialForm: BuilderForm;
  initialMode?: BuilderMode;
  immersiveGraphPage?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [builderMode, setBuilderMode] = useState<BuilderMode>(initialMode);
  const [selection, setSelection] = useState<Selection>(() =>
    initialForm.blocks[0]
      ? { kind: "block", blockId: initialForm.blocks[0].id }
      : { kind: "form" },
  );
  const [hasExplicitGraphSelection, setHasExplicitGraphSelection] =
    useState(false);
  const [selectedGraphEdgeId, setSelectedGraphEdgeId] = useState<string | null>(
    null,
  );
  const { toasts, showToast, dismissToast } = useLocalToasts();
  const [busy, setBusy] = useState<string | null>(null);
  const [isDndReady, setIsDndReady] = useState(false);
  const [isImmersiveSidebarOpen, setIsImmersiveSidebarOpen] = useState(false);

  const [metadataDraft, setMetadataDraft] = useState<FormMetadataDraft>({
    title: initialForm.title,
    completionTitle: initialForm.completionTitle,
    completionMessage: initialForm.completionMessage,
    completionLinkLabel: initialForm.completionLinkLabel ?? "",
    completionLinkUrl: initialForm.completionLinkUrl ?? "",
    respondentLocale: initialForm.respondentLocale,
    showProgress: initialForm.showProgress,
    allowBackNavigation: initialForm.allowBackNavigation,
    webhookUrl: initialForm.webhookUrl ?? "",
    webhookSecret: initialForm.webhookSecret ?? "",
    closesAt: toDateTimeLocalValue(initialForm.closesAt),
    maxResponses:
      initialForm.maxResponses === null ? "" : String(initialForm.maxResponses),
    closedManually: initialForm.closedManually,
    closedMessage: initialForm.closedMessage,
    slug: initialForm.slug,
  });

  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [isDeleteFormDialogOpen, setIsDeleteFormDialogOpen] = useState(false);
  const [isUnpublishDialogOpen, setIsUnpublishDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const blockMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedBlock = useMemo(
    () =>
      selection.kind === "block"
        ? (form.blocks.find((block) => block.id === selection.blockId) ?? null)
        : null,
    [form.blocks, selection],
  );

  const [blockDraft, setBlockDraft] = useState<BuilderBlock | null>(
    selectedBlock,
  );
  const [choiceOptionsDraft, setChoiceOptionsDraft] = useState<
    ChoiceOptionDraft[]
  >(
    selectedBlock &&
      (selectedBlock.type === "SINGLE_CHOICE" ||
        selectedBlock.type === "MULTIPLE_CHOICE")
      ? createChoiceOptionDrafts(
          (selectedBlock.config as ChoiceBlockConfig).options,
        )
      : [],
  );
  const [branchRulesDraft, setBranchRulesDraft] = useState<BranchRuleDraft[]>(
    selectedBlock && isQuestionBlock(selectedBlock.type)
      ? createBranchRuleDrafts(getBranchRules(selectedBlock.config))
      : [],
  );
  const SelectedBlockIcon = blockDraft ? blockIcons[blockDraft.type] : null;
  const graphSelectedBlockId =
    hasExplicitGraphSelection && selection.kind === "block"
      ? selection.blockId
      : null;
  const graphSelectedBlockDraft = hasExplicitGraphSelection ? blockDraft : null;
  const hasUnsavedBlockChanges = useMemo(
    () =>
      selection.kind === "block" &&
      hasBuilderBlockDraftChanges({
        savedBlock: selectedBlock,
        blockDraft,
        choiceOptionsDraft,
        branchRulesDraft,
      }),
    [
      blockDraft,
      branchRulesDraft,
      choiceOptionsDraft,
      selectedBlock,
      selection.kind,
    ],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const branchingAnalysis = useMemo(
    () => analyzeBranchingGraph(form.blocks),
    [form.blocks],
  );

  useEffect(() => {
    setBuilderMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!immersiveGraphPage || builderMode !== "graph") {
      return;
    }

    if (graphSelectedBlockId) {
      setIsImmersiveSidebarOpen(true);
    }
  }, [builderMode, graphSelectedBlockId, immersiveGraphPage]);

  useEffect(() => {
    setMetadataDraft({
      title: form.title,
      completionTitle: form.completionTitle,
      completionMessage: form.completionMessage,
      completionLinkLabel: form.completionLinkLabel ?? "",
      completionLinkUrl: form.completionLinkUrl ?? "",
      respondentLocale: form.respondentLocale,
      showProgress: form.showProgress,
      allowBackNavigation: form.allowBackNavigation,
      webhookUrl: form.webhookUrl ?? "",
      webhookSecret: form.webhookSecret ?? "",
      closesAt: toDateTimeLocalValue(form.closesAt),
      maxResponses: form.maxResponses === null ? "" : String(form.maxResponses),
      closedManually: form.closedManually,
      closedMessage: form.closedMessage,
      slug: form.slug,
    });
  }, [
    form.title,
    form.completionTitle,
    form.completionMessage,
    form.completionLinkLabel,
    form.completionLinkUrl,
    form.respondentLocale,
    form.showProgress,
    form.allowBackNavigation,
    form.webhookUrl,
    form.webhookSecret,
    form.closesAt,
    form.maxResponses,
    form.closedManually,
    form.closedMessage,
    form.slug,
  ]);

  useEffect(() => {
    setBlockDraft(selectedBlock);
    setChoiceOptionsDraft(
      selectedBlock &&
        (selectedBlock.type === "SINGLE_CHOICE" ||
          selectedBlock.type === "MULTIPLE_CHOICE")
        ? createChoiceOptionDrafts(
            (selectedBlock.config as ChoiceBlockConfig).options,
          )
        : [],
    );
    setBranchRulesDraft(
      selectedBlock && isQuestionBlock(selectedBlock.type)
        ? createBranchRuleDrafts(getBranchRules(selectedBlock.config))
        : [],
    );
  }, [selectedBlock]);

  useEffect(() => {
    if (selection.kind !== "block") {
      setSelectedGraphEdgeId(null);
    }
  }, [selection]);

  useEffect(() => {
    setIsDndReady(true);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!blockMenuRef.current?.contains(event.target as Node)) {
        setIsBlockMenuOpen(false);
      }
    }

    if (!isBlockMenuOpen) {
      return;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isBlockMenuOpen]);

  async function withTask(task: string, runner: () => Promise<void>) {
    setBusy(task);

    try {
      await runner();
      return true;
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : t("builder.toasts.genericError");
      showToast(nextError, "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function patchMetadata(draft: FormMetadataDraft) {
    return fetchJson<{ form: BuilderForm }>(`/api/forms/${form.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...draft,
        closesAt: fromDateTimeLocalValue(draft.closesAt),
        maxResponses: parseMaxResponsesDraft(draft.maxResponses),
      }),
    });
  }

  async function saveMetadata() {
    await withTask("metadata", async () => {
      const payload = await patchMetadata(metadataDraft);

      setForm(payload.form);
      showToast(t("builder.toasts.savedFormSettings"));
    });
  }

  // The subscription is the viewer's own and is saved on its own, not with
  // the form settings. The checkbox flips at once and flips back on failure.
  async function setNotificationsEnabled(enabled: boolean) {
    const previous = form.notificationsEnabled;
    setForm((current) => ({ ...current, notificationsEnabled: enabled }));

    const saved = await withTask("notifications", async () => {
      const payload = await fetchJson<{ enabled: boolean }>(
        `/api/forms/${form.id}/notifications`,
        {
          method: "PUT",
          body: JSON.stringify({ enabled }),
        },
      );

      setForm((current) => ({
        ...current,
        notificationsEnabled: payload.enabled,
      }));
    });

    if (!saved) {
      setForm((current) => ({ ...current, notificationsEnabled: previous }));
    }
  }

  async function renameForm(title: string) {
    await withTask("rename", async () => {
      const payload = await patchMetadata({ ...metadataDraft, title });

      setForm(payload.form);
      setMetadataDraft((current) => ({ ...current, title }));
      showToast(t("builder.toasts.renamedForm"));
    });
  }

  async function addBlockNow(type: BlockType) {
    return withTask(`add-${type}`, async () => {
      const payload = await fetchJson<{ block: BuilderBlock }>(
        `/api/forms/${form.id}/blocks`,
        {
          method: "POST",
          body: JSON.stringify({ type }),
        },
      );

      setForm((current) => ({
        ...current,
        blocks: [...current.blocks, payload.block],
      }));
      setSelection({ kind: "block", blockId: payload.block.id });
      setIsBlockMenuOpen(false);
      showToast(
        t("builder.toasts.addedBlock", {
          type: t(blockTypeTranslationKeys[type]),
        }),
      );
    });
  }

  async function addBlockAfter(afterBlockId: string, type: BlockType) {
    return withTask(`add-${type}`, async () => {
      const previous = form.blocks;
      const payload = await fetchJson<{ block: BuilderBlock }>(
        `/api/forms/${form.id}/blocks`,
        {
          method: "POST",
          body: JSON.stringify({ type }),
        },
      );
      const appended = [...previous, payload.block];
      const afterIndex = previous.findIndex(
        (block) => block.id === afterBlockId,
      );
      const reordered = arrayMove(
        appended,
        appended.length - 1,
        afterIndex < 0 ? appended.length - 1 : afterIndex + 1,
      ).map((block, index) => ({ ...block, position: index }));

      setForm((current) => ({ ...current, blocks: reordered }));
      setSelection({ kind: "block", blockId: payload.block.id });
      setHasExplicitGraphSelection(true);
      setSelectedGraphEdgeId(null);
      showToast(
        t("builder.toasts.addedBlock", {
          type: t(blockTypeTranslationKeys[type]),
        }),
      );

      try {
        const reorderPayload = await fetchJson<{ form: BuilderForm }>(
          `/api/forms/${form.id}/blocks/reorder`,
          {
            method: "POST",
            body: JSON.stringify({
              blockIds: reordered.map((block) => block.id),
            }),
          },
        );

        setForm(reorderPayload.form);
      } catch (caughtError) {
        // The block exists on the server at the end of the form; show it there.
        setForm((current) => ({ ...current, blocks: appended }));
        throw caughtError;
      }
    });
  }

  async function saveBlock() {
    if (!blockDraft) {
      return false;
    }

    return withTask(`block-${blockDraft.id}`, async () => {
      const serializedBranchRules = serializeBranchRuleDrafts(branchRulesDraft);
      const payload = await fetchJson<{ block: BuilderBlock }>(
        `/api/forms/${form.id}/blocks/${blockDraft.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: blockDraft.title,
            description: blockDraft.description,
            required: blockDraft.required,
            config:
              blockDraft.type === "SINGLE_CHOICE" ||
              blockDraft.type === "MULTIPLE_CHOICE"
                ? {
                    ...blockDraft.config,
                    options: choiceOptionsDraft.map((option) => option.value),
                    branchRules: serializedBranchRules,
                  }
                : isQuestionBlock(blockDraft.type)
                  ? {
                      ...blockDraft.config,
                      branchRules: serializedBranchRules,
                    }
                  : blockDraft.config,
          }),
        },
      );

      setForm((current) => ({
        ...current,
        blocks: current.blocks.map((block) =>
          block.id === payload.block.id ? payload.block : block,
        ),
      }));
      showToast(t("builder.toasts.savedBlock"));
    });
  }

  async function executePendingNavigation(navigation: PendingNavigation) {
    if (navigation.nextBuilderMode) {
      setBuilderMode(navigation.nextBuilderMode);
    }

    switch (navigation.kind) {
      case "form": {
        setSelection({ kind: "form" });
        setHasExplicitGraphSelection(false);
        setSelectedGraphEdgeId(null);
        break;
      }
      case "block": {
        setSelection({ kind: "block", blockId: navigation.blockId });
        setHasExplicitGraphSelection(
          Boolean(navigation.activateGraphSelection),
        );
        setSelectedGraphEdgeId(navigation.graphEdgeId ?? null);
        break;
      }
      case "add-block": {
        setSelectedGraphEdgeId(null);
        await addBlockNow(navigation.blockType);
        break;
      }
      case "add-block-after": {
        await addBlockAfter(navigation.blockId, navigation.blockType);
        break;
      }
    }
  }

  function requestPendingNavigation(navigation: PendingNavigation) {
    if (navigation.kind === "form" && selection.kind === "form") {
      return;
    }

    if (
      navigation.kind === "block" &&
      selection.kind === "block" &&
      selection.blockId === navigation.blockId
    ) {
      return;
    }

    if (hasUnsavedBlockChanges) {
      setPendingNavigation(navigation);
      return;
    }

    void executePendingNavigation(navigation);
  }

  function openGraphMode() {
    setIsBlockMenuOpen(false);
    setBuilderMode("graph");
    setHasExplicitGraphSelection(false);
    setSelectedGraphEdgeId(null);
    router.push(`/forms/${form.id}/graph`);
  }

  function exitGraphMode() {
    setBuilderMode("standard");
    setHasExplicitGraphSelection(false);
    setSelectedGraphEdgeId(null);
    router.push(`/forms/${form.id}/edit`);
  }

  function openSettings() {
    requestPendingNavigation({
      kind: "form",
      nextBuilderMode: builderMode === "graph" ? "standard" : undefined,
    });
  }

  function selectGraphBlock(blockId: string) {
    if (selection.kind === "block" && selection.blockId === blockId) {
      setHasExplicitGraphSelection(true);
      setSelectedGraphEdgeId(null);
      return;
    }

    requestPendingNavigation({
      kind: "block",
      blockId,
      graphEdgeId: null,
      activateGraphSelection: true,
    });
  }

  async function confirmPendingNavigationWithSave() {
    if (!pendingNavigation) {
      return;
    }

    const navigation = pendingNavigation;
    const didSave = await saveBlock();

    if (!didSave) {
      return;
    }

    setPendingNavigation(null);
    await executePendingNavigation(navigation);
  }

  async function confirmPendingNavigationWithoutSave() {
    if (!pendingNavigation) {
      return;
    }

    const navigation = pendingNavigation;
    setPendingNavigation(null);
    await executePendingNavigation(navigation);
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
      showToast(t("builder.toasts.removedBlock"));
    });
  }

  async function setPublished(published: boolean) {
    await withTask("publish", async () => {
      const payload = await fetchJson<{ form: BuilderForm }>(
        `/api/forms/${form.id}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ published }),
        },
      );

      setForm(payload.form);
      showToast(
        payload.form.status === "PUBLISHED"
          ? t("builder.toasts.formPublished")
          : t("builder.toasts.formDrafted"),
      );
      router.refresh();
    });
  }

  function requestUnpublish() {
    if (form.responseCount > 0) {
      setIsUnpublishDialogOpen(true);
      return;
    }

    void setPublished(false);
  }

  async function confirmUnpublish() {
    setIsUnpublishDialogOpen(false);
    await setPublished(false);
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/f/${form.slug}`;
    await navigator.clipboard.writeText(url);
    showToast(t("builder.toasts.copiedShareLink"));
  }

  function deleteForm() {
    setIsDeleteFormDialogOpen(true);
  }

  async function confirmDeleteForm() {
    await withTask("delete-form", async () => {
      await fetchJson(`/api/forms/${form.id}`, {
        method: "DELETE",
      });

      setIsDeleteFormDialogOpen(false);
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

    const reordered = arrayMove(previous, oldIndex, newIndex).map(
      (block, index) => ({ ...block, position: index }),
    );
    setForm((current) => ({ ...current, blocks: reordered }));

    try {
      const payload = await fetchJson<{ form: BuilderForm }>(
        `/api/forms/${form.id}/blocks/reorder`,
        {
          method: "POST",
          body: JSON.stringify({
            blockIds: reordered.map((block) => block.id),
          }),
        },
      );

      setForm(payload.form);
      showToast(t("builder.toasts.updatedBlockOrder"));
    } catch (caughtError) {
      setForm((current) => ({ ...current, blocks: previous }));
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : t("builder.toasts.reorderError"),
        "error",
      );
    }
  }

  const shareHref = `/f/${form.slug}`;
  const workspaceLabel =
    form.workspace.kind === "personal"
      ? t("workspace.personal")
      : form.workspace.label;
  const isImmersiveGraphPage = immersiveGraphPage && builderMode === "graph";

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        open={isDeleteFormDialogOpen}
        onClose={() => setIsDeleteFormDialogOpen(false)}
        title={t("builder.deleteFormTitle")}
        description={t("builder.deleteFormDescription")}
        confirmLabel={t("ui.delete")}
        cancelLabel={t("ui.cancel")}
        pending={busy === "delete-form"}
        onConfirm={confirmDeleteForm}
      />
      <ConfirmDialog
        open={isUnpublishDialogOpen}
        onClose={() => setIsUnpublishDialogOpen(false)}
        title={t("builder.unpublishTitle")}
        description={t("builder.unpublishDescription", {
          count: form.responseCount,
        })}
        confirmLabel={t("builder.unpublish")}
        cancelLabel={t("ui.cancel")}
        pending={busy === "publish"}
        onConfirm={confirmUnpublish}
      />
      <ConfirmDialog
        open={pendingNavigation !== null}
        onClose={() => setPendingNavigation(null)}
        title={t("builder.unsavedBlockChangesTitle")}
        description={t("builder.unsavedBlockChangesDescription")}
        confirmLabel={t("builder.saveBlockChanges")}
        cancelLabel={t("ui.cancel")}
        pending={Boolean(busy?.startsWith("block-"))}
        actions={
          <div className="mt-6 flex items-center justify-end gap-2 whitespace-nowrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPendingNavigation(null)}
              disabled={Boolean(busy?.startsWith("block-"))}
            >
              {t("builder.backFromUnsavedBlockChanges")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => void confirmPendingNavigationWithoutSave()}
              disabled={Boolean(busy?.startsWith("block-"))}
            >
              {t("builder.cancelBlockChanges")}
            </Button>
            <Button
              size="sm"
              onClick={() => void confirmPendingNavigationWithSave()}
              disabled={Boolean(busy?.startsWith("block-"))}
            >
              {busy?.startsWith("block-") ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {t("builder.saveBlockChanges")}
            </Button>
          </div>
        }
      />
      <div
        className={cn(
          "space-y-6",
          isImmersiveGraphPage &&
            "relative left-1/2 right-1/2 -mt-8 -mb-8 h-[calc(100dvh-5.5rem)] w-screen -translate-x-1/2 overflow-hidden space-y-0",
        )}
      >
        {builderMode === "graph" ? (
          isImmersiveGraphPage ? null : (
            <PageHeader
              title={form.title}
              metadata={workspaceLabel}
              actions={
                <Button variant="secondary" onClick={exitGraphMode}>
                  <ArrowLeft className="size-4" />
                  {t("builder.exitGraphMode")}
                </Button>
              }
            />
          )
        ) : (
          <BuilderHeader
            form={form}
            settingsSelected={selection.kind === "form"}
            busy={busy}
            shareHref={shareHref}
            onOpenSettings={openSettings}
            onPublish={() => setPublished(true)}
            onUnpublish={requestUnpublish}
            onCopyShareLink={copyShareLink}
            onRenameForm={renameForm}
          />
        )}

        {!isImmersiveGraphPage && branchingAnalysis.blockers.length ? (
          <div className="rounded-[18px] border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-[var(--ink)]">
            <p className="font-medium">
              {t("builder.branchingBlockersTitle", {
                count: branchingAnalysis.blockers.length,
              })}
            </p>
            <p className="mt-1 text-[var(--muted)]">
              {t("builder.branchingBlockersDescription")}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--muted)]">
              {branchingAnalysis.blockers.slice(0, 5).map((issue, index) => {
                const issueI18n = getBranchValidationIssueI18n(
                  issue,
                  form.blocks,
                );
                return (
                  <li
                    key={`${issue.blockId}-${issue.code}-${issue.ruleIndex ?? index}`}
                  >
                    {t(issueI18n.key, issueI18n.values)}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {!isImmersiveGraphPage && branchingAnalysis.warnings.length ? (
          <div className="rounded-[18px] border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-sm text-[var(--ink)]">
            <p className="font-medium">
              {t("builder.branchingWarningsTitle", {
                count: branchingAnalysis.warnings.length,
              })}
            </p>
            <p className="mt-1 text-[var(--muted)]">
              {t("builder.branchingWarningsDescription")}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--muted)]">
              {branchingAnalysis.warnings.slice(0, 5).map((issue, index) => {
                const issueI18n = getBranchValidationIssueI18n(
                  issue,
                  form.blocks,
                );
                return (
                  <li
                    key={`${issue.blockId}-${issue.code}-${issue.ruleIndex ?? index}`}
                  >
                    {t(issueI18n.key, issueI18n.values)}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {builderMode === "graph" ? (
          <BranchingGraphWorkspace
            formId={form.id}
            allBlocks={form.blocks}
            selectedBlockId={graphSelectedBlockId}
            selectedGraphEdgeId={selectedGraphEdgeId}
            blockDraft={graphSelectedBlockDraft}
            branchRulesDraft={branchRulesDraft}
            branchValidationIssues={[
              ...branchingAnalysis.blockers,
              ...branchingAnalysis.warnings,
            ]}
            selectedBlockIcon={SelectedBlockIcon}
            choiceOptionsDraft={choiceOptionsDraft}
            setChoiceOptionsDraft={setChoiceOptionsDraft}
            setBlockDraft={setBlockDraft}
            setBranchRulesDraft={setBranchRulesDraft}
            deleteBlock={deleteBlock}
            saveBlock={saveBlock}
            busy={busy}
            onSelectBlock={selectGraphBlock}
            onAddBlockAfter={(blockId, blockType) =>
              requestPendingNavigation({
                kind: "add-block-after",
                blockId,
                blockType,
              })
            }
            immersive={isImmersiveGraphPage}
            hideInspector={false}
            immersiveInspectorOpen={
              isImmersiveGraphPage && isImmersiveSidebarOpen
            }
            immersiveFormTitle={form.title}
            onCloseImmersiveInspector={() => setIsImmersiveSidebarOpen(false)}
            overlay={
              isImmersiveGraphPage ? (
                <>
                  <div className="fixed left-4 top-4 z-30 sm:left-4 sm:top-4">
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label="Toggle block settings"
                      title="Toggle block settings"
                      onClick={() =>
                        setIsImmersiveSidebarOpen((current) => !current)
                      }
                    >
                      <PanelRight className="size-4" />
                    </Button>
                  </div>
                  <div className="fixed z-30 sm:right-4 sm:top-4">
                    <Button variant="secondary" onClick={exitGraphMode}>
                      <ArrowLeft className="size-4" />
                      {t("builder.exitGraphMode")}
                    </Button>
                  </div>
                </>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-8 lg:min-h-[calc(100vh-14rem)] lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="border-b border-[color:var(--line)] pb-6 lg:sticky lg:top-8 lg:flex lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-3xl text-[var(--ink)]">
                  {t("builder.blocks")}
                </h2>
                <div
                  className="relative flex items-center gap-2"
                  ref={blockMenuRef}
                >
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={t("builder.openGraphMode")}
                    title={t("builder.openGraphMode")}
                    onClick={openGraphMode}
                  >
                    <GitBranch
                      size={18}
                      color="var(--ink)"
                      strokeWidth={2.25}
                    />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => setIsBlockMenuOpen((current) => !current)}
                    aria-label={t("builder.newBlock")}
                    title={t("builder.newBlock")}
                    aria-expanded={isBlockMenuOpen}
                    aria-haspopup="menu"
                  >
                    <Plus size={18} color="var(--bg)" strokeWidth={2.5} />
                  </Button>
                  {isBlockMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 min-w-[220px] rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] p-2 shadow-[var(--shadow-card)]">
                      <div className="grid gap-1">
                        {blockCreationOrder.map((type) => {
                          const Icon = blockIcons[type];

                          return (
                            <button
                              key={type}
                              type="button"
                              className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)]"
                              onClick={() =>
                                requestPendingNavigation({
                                  kind: "add-block",
                                  blockType: type,
                                })
                              }
                            >
                              {busy === `add-${type}` ? (
                                <LoaderCircle className="size-4 animate-spin" />
                              ) : (
                                <Icon className="size-4" />
                              )}
                              {t(blockTypeTranslationKeys[type])}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
                <div className="space-y-1.5">
                  {isDndReady ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={form.blocks.map((block) => block.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {form.blocks.map((block) => (
                          <SortableBlockRow
                            key={block.id}
                            block={block}
                            selected={
                              selection.kind === "block" &&
                              selection.blockId === block.id
                            }
                            onSelect={(blockId) =>
                              requestPendingNavigation({
                                kind: "block",
                                blockId,
                              })
                            }
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  ) : (
                    form.blocks.map((block) => (
                      <StaticBlockRow
                        key={block.id}
                        block={block}
                        selected={
                          selection.kind === "block" &&
                          selection.blockId === block.id
                        }
                        onSelect={(blockId) =>
                          requestPendingNavigation({ kind: "block", blockId })
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </aside>

            <section className="min-w-0 border-t border-[color:var(--line)] pt-6 lg:min-h-full lg:border-t-0 lg:pt-0">
              {selection.kind === "form" ? (
                <FormSettingsPanel
                  form={form}
                  metadataDraft={metadataDraft}
                  setMetadataDraft={setMetadataDraft}
                  shareHref={shareHref}
                  copyShareLink={copyShareLink}
                  deleteForm={deleteForm}
                  saveMetadata={saveMetadata}
                  setNotificationsEnabled={setNotificationsEnabled}
                  busy={busy}
                />
              ) : blockDraft ? (
                <BlockEditorPanel
                  allBlocks={form.blocks}
                  blockDraft={blockDraft}
                  selectedBlockIcon={SelectedBlockIcon}
                  choiceOptionsDraft={choiceOptionsDraft}
                  branchRulesDraft={branchRulesDraft}
                  branchValidationIssues={[
                    ...branchingAnalysis.blockers,
                    ...branchingAnalysis.warnings,
                  ]}
                  setChoiceOptionsDraft={setChoiceOptionsDraft}
                  setBranchRulesDraft={setBranchRulesDraft}
                  setBlockDraft={setBlockDraft}
                  deleteBlock={deleteBlock}
                  saveBlock={saveBlock}
                  busy={busy}
                />
              ) : (
                <EmptyEditorState
                  onAddShortText={() =>
                    requestPendingNavigation({
                      kind: "add-block",
                      blockType: "SHORT_TEXT",
                    })
                  }
                />
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
