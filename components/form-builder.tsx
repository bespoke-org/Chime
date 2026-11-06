"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  Plus,
  GitBranch,
  SquareSplitVertical,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import {
  blockCreationOrder,
  blockIcons,
  buildPageSections,
  countBlockCandidates,
  deletePageById,
  insertionForGap,
  movePageToAnchor,
  pageIdAfterDrop,
  pageIdForNewBlock,
  splitPageAfter,
  type BlockType,
  type BuilderPageSection,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  getBlockDisplayLabel,
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
import type {
  BuilderBlock,
  BuilderForm,
  FormWebhookInput,
  FormWebhookSummary,
} from "@/lib/form-types";
import {
  resolvePages,
  type PageDefinition,
  type PageRepeatSettings,
} from "@/lib/pages";
import {
  validateRepeatSettings,
  type RepeatValidationIssueCode,
} from "@/lib/repeat";
import { cn } from "@/lib/utils";

// Where the repeat placement warnings of lib/repeat.ts live: one line on the
// header of the page whose stored settings do not resolve. The branch
// warnings have their own panel above the builder; these sit next to their
// cause.
const repeatIssueMessageKeys: Record<RepeatValidationIssueCode, string> = {
  repeat_count_block_missing: "formPages.repeatCountMissing",
  repeat_count_block_not_number: "formPages.repeatCountNotNumber",
  repeat_count_block_on_page: "formPages.repeatCountOnPage",
  repeat_count_block_after_page: "formPages.repeatCountAfterPage",
  repeat_count_block_repeats: "formPages.repeatCountRepeats",
};

// The repeat control edits one registry entry: a present repeat replaces the
// stored one, null removes the field. The rest of the entry passes through.
function withPageRepeat(
  definition: PageDefinition,
  repeat: PageRepeatSettings | null,
): PageDefinition {
  if (!repeat) {
    const next = { ...definition };
    delete next.repeat;
    return next;
  }

  return { ...definition, repeat };
}

type BuilderMode = "standard" | "graph";

type Selection = { kind: "form" } | { kind: "block"; blockId: string };

// Where a block created from the sidebar lands in the flat block order.
type BlockInsertion =
  | { kind: "end" }
  | { kind: "after"; blockId: string }
  | { kind: "before"; blockId: string };

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
    }
  | {
      kind: "insert-block";
      blockType: BlockType;
      pageId: string | null;
      insertion: BlockInsertion;
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
        "group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2",
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
        "group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2",
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

// The block type list shared by the header menu and the insertion points.
function BlockTypeMenu({
  busy,
  onSelect,
}: {
  busy: string | null;
  onSelect: (type: BlockType) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid gap-1">
      {blockCreationOrder.map((type) => {
        const Icon = blockIcons[type];

        return (
          <button
            key={type}
            type="button"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)]"
            onClick={() => onSelect(type)}
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
  );
}

// The clickable page name in the header. Unnamed pages show the number
// label; committing an empty string resets the page to that label.
function PageNameLabel({
  fallbackLabel,
  name,
  onRename,
}: {
  fallbackLabel: string;
  name: string | null;
  onRename: (name: string) => void;
}) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.select();
    }
  }, [isEditing]);

  function commit() {
    setIsEditing(false);

    if (draft.trim() !== (name ?? "")) {
      onRename(draft.trim());
    }
  }

  function cancel() {
    setIsEditing(false);
    setDraft(name ?? "");
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        aria-label={t("formPages.renamePage")}
        title={t("formPages.renamePage")}
        className="min-w-0 truncate rounded text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] transition hover:text-[var(--ink)]"
        onClick={() => {
          setDraft(name ?? "");
          setIsEditing(true);
        }}
      >
        {name || fallbackLabel}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      aria-label={t("formPages.renamePage")}
      maxLength={100}
      className="min-w-0 max-w-full rounded border-b border-[color:var(--line-strong)] bg-transparent text-[11px] font-semibold uppercase tracking-wider text-[var(--ink)] outline-none"
      value={draft}
      placeholder={fallbackLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
}

// The page header above a page's blocks. Deleting moves the blocks to the
// previous page, which the hint next to the delete action spells out. The
// repeat row under the title edits the registry entry's repeat: the toggle
// turns it on with the first offered count question and off again, the select
// moves it to another one.
function PageHeaderRow({
  label,
  name,
  canDelete,
  hasBlocks,
  onDelete,
  onRenamePage,
  repeat,
  candidates,
  countBlockTitle,
  warning,
  onToggleRepeat,
  onPickCountBlock,
  dragHandle,
}: {
  label: string;
  name: string | null;
  canDelete: boolean;
  hasBlocks: boolean;
  onDelete: () => void;
  onRenamePage: (name: string) => void;
  repeat: PageRepeatSettings | null;
  candidates: Array<{ id: string; title: string }>;
  countBlockTitle: string | null;
  warning: string | null;
  onToggleRepeat: (enabled: boolean) => void;
  onPickCountBlock: (blockId: string) => void;
  dragHandle?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="px-2.5 pb-0.5 pt-2">
      <div className="flex items-center gap-2">
        {dragHandle}
        <PageNameLabel
          fallbackLabel={label}
          name={name}
          onRename={onRenamePage}
        />
        <span className="h-px flex-1 bg-[color:var(--line)]" />
        {canDelete ? (
          <button
            type="button"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--danger-hover)] hover:text-[var(--danger-contrast)]"
            aria-label={t("formPages.deletePage")}
            title={
              hasBlocks
                ? t("formPages.deletePageMergeHint")
                : t("formPages.deletePage")
            }
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]"
          title={
            candidates.length === 0
              ? t("formPages.repeatNoCandidates")
              : undefined
          }
        >
          <Checkbox
            checked={Boolean(repeat)}
            disabled={candidates.length === 0}
            onChange={(event) => onToggleRepeat(event.target.checked)}
          />
          {t("formPages.repeatToggle")}
        </label>
        {repeat && candidates.length > 0 ? (
          <label className="inline-flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)]">
            {t("formPages.repeatCountQuestion")}
            <select
              className="max-w-[9.5rem] truncate rounded-md border border-[color:var(--line)] bg-[var(--surface-strong)] px-1.5 py-0.5 text-xs font-medium text-[var(--ink)]"
              value={
                candidates.some(
                  (candidate) => candidate.id === repeat.countBlockId,
                )
                  ? repeat.countBlockId
                  : ""
              }
              onChange={(event) => onPickCountBlock(event.target.value)}
            >
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {repeat && candidates.length === 0 ? (
          <span className="text-xs text-[var(--muted)]">
            {t("formPages.repeatNoCandidates")}
          </span>
        ) : null}
        {repeat && countBlockTitle ? (
          <span className="min-w-0 truncate text-xs text-[var(--muted)]">
            {t("formPages.repeatActive", { question: countBlockTitle })}
          </span>
        ) : null}
      </div>
      {warning ? (
        <p className="mt-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs leading-4 text-[var(--ink)]">
          {warning}
        </p>
      ) : null}
    </div>
  );
}

// A page header that drags its whole page: the run of blocks below travels
// with the registry entry, see handleDragEnd.
function SortablePageHeaderRow({
  pageId,
  headerProps,
}: {
  pageId: string;
  headerProps: Parameters<typeof PageHeaderRow>[0];
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: `page:${pageId}` });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="group/page"
    >
      <PageHeaderRow
        {...headerProps}
        dragHandle={
          <button
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[var(--muted)] opacity-0 transition hover:bg-[var(--accent-soft)] group-hover/page:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            type="button"
            aria-label={t("formPages.dragPage")}
            title={t("formPages.dragPage")}
            onClick={(event) => event.stopPropagation()}
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

// The hover affordance between blocks: a thin rule across the gap with a
// small plus on it. The whole gap row is the hover zone, so nothing floats
// over the neighbouring rows. The plus opens the block type menu; when a new
// page may start at this point, the menu offers it below the types.
function BlockInsertionDivider({
  busy,
  onAddBlock,
  onNewPage,
}: {
  busy: string | null;
  onAddBlock: (type: BlockType) => void;
  onNewPage: (() => void) | null;
}) {
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      className="group/divider relative h-3"
      // The list separates rows with margins, and the gap row must not grow
      // beyond its own height.
      style={{ marginBottom: 0 }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[color:var(--line-strong)] transition-opacity",
          isMenuOpen
            ? "opacity-100"
            : "opacity-0 group-hover/divider:opacity-100",
        )}
      />
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity",
          isMenuOpen
            ? "opacity-100"
            : "opacity-0 group-hover/divider:opacity-100 focus-within:opacity-100",
        )}
      >
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex size-5 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--bg-strong)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--ink)]"
              aria-label={t("builder.newBlock")}
              title={t("builder.newBlock")}
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="max-h-[var(--radix-popover-content-available-height)] w-auto min-w-[220px] overflow-y-auto rounded-[10px] bg-[var(--bg-strong)] p-2 shadow-[var(--shadow-elevated)]"
          >
            <BlockTypeMenu busy={busy} onSelect={onAddBlock} />
            {onNewPage ? (
              <>
                <div className="my-1 h-px bg-[color:var(--line)]" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)]"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNewPage();
                  }}
                >
                  <SquareSplitVertical className="size-4" />
                  {t("formPages.newPage")}
                </button>
              </>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function FormBuilder({
  initialForm,
  initialMode = "standard",
}: {
  initialForm: BuilderForm;
  initialMode?: BuilderMode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
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

  const [metadataDraft, setMetadataDraft] = useState<FormMetadataDraft>({
    title: initialForm.title,
    completionTitle: initialForm.completionTitle,
    completionMessage: initialForm.completionMessage,
    completionLinkLabel: initialForm.completionLinkLabel ?? "",
    completionLinkUrl: initialForm.completionLinkUrl ?? "",
    respondentLocale: initialForm.respondentLocale,
    showProgress: initialForm.showProgress,
    allowBackNavigation: initialForm.allowBackNavigation,
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
  const [blockIdPendingDelete, setBlockIdPendingDelete] = useState<
    string | null
  >(null);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);

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
  // Page-aware validation needs the registry: without it every block is a
  // single-block page and the ignored-rules warning never fires.
  const branchingAnalysis = useMemo(
    () => analyzeBranchingGraph(form.blocks, form.pages ?? []),
    [form.blocks, form.pages],
  );
  // The resolved pages feed the repeat placement warnings shown on the page
  // headers.
  const repeatIssues = useMemo(
    () => validateRepeatSettings(resolvePages(form.blocks, form.pages ?? [])),
    [form.blocks, form.pages],
  );

  // Sections the sidebar renders. A form without a page registry is one
  // headerless run of blocks, so it looks exactly as it did before pages.
  const sections = useMemo<BuilderPageSection[]>(() => {
    const pages = form.pages ?? [];

    if (pages.length === 0) {
      return form.blocks.length
        ? [{ id: "__unpaged__", definition: null, blocks: form.blocks }]
        : [];
    }

    return buildPageSections(form.blocks, pages);
  }, [form.blocks, form.pages]);

  // Back and forward between /edit and /graph change only the URL, since
  // switchBuilderMode moves between them without a server navigation.
  useEffect(() => {
    if (pathname === lastPathname.current) {
      return;
    }

    lastPathname.current = pathname;
    setBuilderMode(pathname.endsWith("/graph") ? "graph" : "standard");
  }, [pathname]);

  // Backspace or Delete asks to remove the selected block, unless the key
  // is meant for a text field or a dialog is already open.
  const blockIdForDeleteKey =
    builderMode === "graph"
      ? graphSelectedBlockId
      : selection.kind === "block"
        ? selection.blockId
        : null;
  const isAnyDialogOpen =
    isDeleteFormDialogOpen ||
    isUnpublishDialogOpen ||
    pendingNavigation !== null ||
    blockIdPendingDelete !== null;

  useEffect(() => {
    if (!blockIdForDeleteKey || isAnyDialogOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (
        target?.isContentEditable ||
        target?.closest("input, textarea, select, [role='dialog']")
      ) {
        return;
      }

      event.preventDefault();
      setBlockIdPendingDelete(blockIdForDeleteKey);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blockIdForDeleteKey, isAnyDialogOpen]);

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

  function patchMetadata(draft: FormMetadataDraft, pages?: PageDefinition[]) {
    return fetchJson<{ form: BuilderForm }>(`/api/forms/${form.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...draft,
        closesAt: fromDateTimeLocalValue(draft.closesAt),
        maxResponses: parseMaxResponsesDraft(draft.maxResponses),
        // The page registry travels with the form payload: present replaces
        // the stored registry, an empty array clears it, absent leaves it.
        ...(pages ? { pages } : {}),
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

  // Webhooks are saved one at a time through their own endpoints; every
  // answer carries the form's whole list, which replaces the one shown.
  async function saveWebhook(
    webhookId: string | null,
    input: FormWebhookInput,
  ) {
    return withTask("webhook", async () => {
      const payload = await fetchJson<{ webhooks: FormWebhookSummary[] }>(
        webhookId
          ? `/api/forms/${form.id}/webhooks/${webhookId}`
          : `/api/forms/${form.id}/webhooks`,
        {
          method: webhookId ? "PATCH" : "POST",
          body: JSON.stringify(input),
        },
      );

      setForm((current) => ({ ...current, webhooks: payload.webhooks }));
      showToast(t("builder.toasts.savedWebhook"));
    });
  }

  async function deleteWebhook(webhookId: string) {
    return withTask("webhook", async () => {
      const payload = await fetchJson<{ webhooks: FormWebhookSummary[] }>(
        `/api/forms/${form.id}/webhooks/${webhookId}`,
        { method: "DELETE" },
      );

      setForm((current) => ({ ...current, webhooks: payload.webhooks }));
      showToast(t("builder.toasts.removedWebhook"));
    });
  }

  // The title changes at once and changes back on failure, so the old one
  // does not flash while the request is in flight.
  async function renameForm(title: string) {
    const previous = form.title;
    setForm((current) => ({ ...current, title }));

    const saved = await withTask("rename", async () => {
      const payload = await patchMetadata({ ...metadataDraft, title });

      setForm(payload.form);
      setMetadataDraft((current) => ({ ...current, title }));
      showToast(t("builder.toasts.renamedForm"));
    });

    if (!saved) {
      setForm((current) => ({ ...current, title: previous }));
    }
  }

  // Creates a block on the server and places it in the flat order: "end"
  // keeps the position the server assigned, any other placement is saved
  // through the reorder endpoint exactly as the graph insertion does. The
  // block lands on the page it is created under.
  async function createBlockAt(args: {
    type: BlockType;
    pageId: string | null;
    insertion: BlockInsertion;
  }): Promise<BuilderBlock> {
    const payload = await fetchJson<{ block: BuilderBlock }>(
      `/api/forms/${form.id}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({ type: args.type, pageId: args.pageId }),
      },
    );
    // A payload that predates pages may not echo the page back; keep the
    // intended one until the next save.
    const created = {
      ...payload.block,
      pageId: payload.block.pageId ?? args.pageId,
    };

    if (args.insertion.kind === "end") {
      setForm((current) => ({
        ...current,
        blocks: [...current.blocks, created],
      }));

      return created;
    }

    const previous = form.blocks;
    const appended = [...previous, created];
    // Hoisted so the findIndex callback keeps the narrowed insertion type.
    const anchorBlockId = args.insertion.blockId;
    const anchorIndex = previous.findIndex(
      (block) => block.id === anchorBlockId,
    );
    const targetIndex =
      anchorIndex < 0
        ? appended.length - 1
        : args.insertion.kind === "before"
          ? anchorIndex
          : anchorIndex + 1;
    const reordered = arrayMove(appended, appended.length - 1, targetIndex).map(
      (block, index) => ({ ...block, position: index }),
    );

    setForm((current) => ({ ...current, blocks: reordered }));

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

    return created;
  }

  async function addBlockNow(type: BlockType) {
    return withTask(`add-${type}`, async () => {
      const created = await createBlockAt({
        type,
        pageId: pageIdForNewBlock({
          pages: form.pages ?? [],
          blocks: form.blocks,
          afterBlockId: null,
        }),
        insertion: { kind: "end" },
      });

      setSelection({ kind: "block", blockId: created.id });
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
      const created = await createBlockAt({
        type,
        pageId: pageIdForNewBlock({
          pages: form.pages ?? [],
          blocks: form.blocks,
          afterBlockId,
        }),
        insertion: { kind: "after", blockId: afterBlockId },
      });

      setSelection({ kind: "block", blockId: created.id });
      setHasExplicitGraphSelection(true);
      setSelectedGraphEdgeId(null);
      showToast(
        t("builder.toasts.addedBlock", {
          type: t(blockTypeTranslationKeys[type]),
        }),
      );
    });
  }

  async function insertBlockFromSidebar(args: {
    type: BlockType;
    pageId: string | null;
    insertion: BlockInsertion;
  }) {
    return withTask(`add-${args.type}`, async () => {
      const created = await createBlockAt(args);

      setSelection({ kind: "block", blockId: created.id });
      showToast(
        t("builder.toasts.addedBlock", {
          type: t(blockTypeTranslationKeys[args.type]),
        }),
      );
    });
  }

  // Applies a page structure change optimistically and persists it: block
  // pageIds go through their own update endpoint, the registry with the form
  // metadata. On failure the previous structure returns.
  async function applyPageStructure(next: {
    blocks: BuilderBlock[];
    pages: PageDefinition[];
  }) {
    const previousBlocks = form.blocks;
    const previousPages = form.pages ?? [];
    const previousById = new Map(
      previousBlocks.map((block) => [block.id, block]),
    );
    const changedBlocks = next.blocks.filter((block) => {
      const before = previousById.get(block.id);

      return before
        ? (before.pageId ?? null) !== (block.pageId ?? null)
        : false;
    });

    setForm((current) => ({
      ...current,
      blocks: next.blocks,
      pages: next.pages,
    }));

    try {
      await Promise.all(
        changedBlocks.map((block) =>
          fetchJson(`/api/forms/${form.id}/blocks/${block.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              title: block.title,
              description: block.description,
              required: block.required,
              config: block.config,
              pageId: block.pageId ?? null,
            }),
          }),
        ),
      );

      if (JSON.stringify(next.pages) !== JSON.stringify(previousPages)) {
        const payload = await patchMetadata(metadataDraft, next.pages);

        setForm(payload.form);
      }

      return true;
    } catch (caughtError) {
      setForm((current) => ({
        ...current,
        blocks: previousBlocks,
        pages: previousPages,
      }));
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : t("builder.toasts.genericError"),
        "error",
      );

      return false;
    }
  }

  // Persist page order and the registry together, including empty pages.
  async function applyPageMove(next: {
    blocks: BuilderBlock[];
    pages: PageDefinition[];
  }) {
    const previousBlocks = form.blocks;
    const previousPages = form.pages ?? [];

    setForm((current) => ({
      ...current,
      blocks: next.blocks,
      pages: next.pages,
    }));

    setBusy("reorder-pages");

    try {
      const payload = await fetchJson<{ form: BuilderForm }>(
        `/api/forms/${form.id}/blocks/reorder`,
        {
          method: "POST",
          body: JSON.stringify({
            blockIds: next.blocks.map((block) => block.id),
            pages: next.pages,
          }),
        },
      );

      setForm(payload.form);

      showToast(t("builder.toasts.updatedPageOrder"));
    } catch (caughtError) {
      setForm((current) => ({
        ...current,
        blocks: previousBlocks,
        pages: previousPages,
      }));
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : t("builder.toasts.reorderError"),
        "error",
      );
    } finally {
      setBusy(null);
    }
  }

  function requestNewPageAfter(afterBlockId: string) {
    const next = splitPageAfter({
      blocks: form.blocks,
      pages: form.pages ?? [],
      afterBlockId,
    });

    if (next) {
      void applyPageStructure(next);
    }
  }

  function requestDeletePage(pageId: string) {
    const next = deletePageById({
      blocks: form.blocks,
      pages: form.pages ?? [],
      pageId,
    });

    if (next) {
      void applyPageStructure(next);
    }
  }

  // The repeat control edits one registry entry through the same save path
  // as the other page operations: the blocks are untouched, the registry
  // travels with the form metadata.
  function requestSetPageRepeat(
    pageId: string,
    repeat: PageRepeatSettings | null,
  ) {
    const pages = form.pages ?? [];

    if (!pages.some((definition) => definition.id === pageId)) {
      return;
    }

    void applyPageStructure({
      blocks: form.blocks,
      pages: pages.map((definition) =>
        definition.id === pageId
          ? withPageRepeat(definition, repeat)
          : definition,
      ),
    });
  }

  // An empty name clears the page name: the header falls back to the number
  // label and the runner shows no heading.
  function requestRenamePage(pageId: string, name: string) {
    const pages = form.pages ?? [];

    if (!pages.some((definition) => definition.id === pageId)) {
      return;
    }

    void applyPageStructure({
      blocks: form.blocks,
      pages: pages.map((definition) =>
        definition.id === pageId
          ? { ...definition, name: name || undefined }
          : definition,
      ),
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
      switchBuilderMode(navigation.nextBuilderMode);
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
      case "insert-block": {
        await insertBlockFromSidebar({
          type: navigation.blockType,
          pageId: navigation.pageId,
          insertion: navigation.insertion,
        });
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

  // Both modes render from the same data, so switching keeps the builder
  // mounted and only updates the URL; a reload lands on the matching page.
  function switchBuilderMode(mode: BuilderMode) {
    setBuilderMode(mode);
    const path = `/forms/${form.id}/${mode === "graph" ? "graph" : "edit"}`;

    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  }

  function openGraphMode() {
    setIsBlockMenuOpen(false);
    switchBuilderMode("graph");
    setHasExplicitGraphSelection(false);
    setSelectedGraphEdgeId(null);
  }

  function exitGraphMode() {
    switchBuilderMode("standard");
    setHasExplicitGraphSelection(false);
    setSelectedGraphEdgeId(null);
  }

  function openSettings() {
    requestPendingNavigation({
      kind: "form",
      nextBuilderMode: builderMode === "graph" ? "standard" : undefined,
    });
  }

  // The graph panel is open exactly while a block is selected. Unsaved edits
  // keep the selection, so clicking the canvas does not discard them.
  function clearGraphSelection() {
    if (hasUnsavedBlockChanges) {
      return;
    }

    setHasExplicitGraphSelection(false);
    setSelectedGraphEdgeId(null);
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

  async function confirmDeleteBlock() {
    if (!blockIdPendingDelete) {
      return;
    }

    await deleteBlock(blockIdPendingDelete);
    setBlockIdPendingDelete(null);
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

    if (busy || !over || active.id === over.id) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    // A dragged page header moves its whole page; everything else is the
    // block drag that follows.
    if (activeId.startsWith("page:")) {
      const targetPageId = overId.startsWith("page:")
        ? overId.slice("page:".length)
        : (sections.find((section) =>
            section.blocks.some((block) => block.id === overId),
          )?.definition?.id ?? null);

      const next = targetPageId
        ? movePageToAnchor({
            blocks: form.blocks,
            pages: form.pages ?? [],
            draggedPageId: activeId.slice("page:".length),
            targetPageId,
          })
        : null;

      if (next) {
        void applyPageMove(next);
      }

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
    // A drop onto a block of another page moves the block to that page; a
    // drop inside its own page keeps the page it has.
    const droppedPageId = pageIdAfterDrop({
      blocks: previous,
      pages: form.pages ?? [],
      draggedBlockId: String(active.id),
      overBlockId: String(over.id),
    });
    const movedBlock = droppedPageId === undefined ? null : previous[oldIndex];
    const finalBlocks = movedBlock
      ? reordered.map((block) =>
          block.id === movedBlock.id
            ? { ...block, pageId: droppedPageId ?? null }
            : block,
        )
      : reordered;

    setForm((current) => ({ ...current, blocks: finalBlocks }));

    try {
      if (movedBlock) {
        await fetchJson(`/api/forms/${form.id}/blocks/${movedBlock.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: movedBlock.title,
            description: movedBlock.description,
            required: movedBlock.required,
            config: movedBlock.config,
            pageId: droppedPageId,
          }),
        });
      }

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

  // The sidebar list: a header above each page's blocks, an insertion point
  // after every block and under an empty page's header. "New page" sits at
  // the insertion points, except at page boundaries where a break exists.
  function renderBlockList(sortable: boolean) {
    let headerNumber = 0;

    return sections.map((section, sectionIndex) => {
      const { definition } = section;
      const number = definition ? (headerNumber += 1) : null;
      const isLastSection = sectionIndex === sections.length - 1;
      const otherPagesExist = sections.some(
        (other, index) => index !== sectionIndex && other.definition,
      );
      const insertAtGap =
        (gapIndex: number) =>
        (type: BlockType): void =>
          requestPendingNavigation({
            kind: "insert-block",
            blockType: type,
            pageId: definition?.id ?? null,
            insertion: insertionForGap(sections, sectionIndex, gapIndex),
          });
      const repeatCandidates = countBlockCandidates(sections, sectionIndex);
      const repeatIssue = definition
        ? (repeatIssues.find((issue) => issue.pageId === definition.id) ?? null)
        : null;
      const countBlock = definition?.repeat
        ? (form.blocks.find(
            (block) => block.id === definition.repeat?.countBlockId,
          ) ?? null)
        : null;

      return (
        <Fragment key={definition ? definition.id : section.id}>
          {definition ? (
            sortable ? (
              <SortablePageHeaderRow
                pageId={definition.id}
                headerProps={{
                  label: t("formPages.pageLabel", { number: number ?? 0 }),
                  name: definition.name ?? null,
                  canDelete: sectionIndex > 0 || !otherPagesExist,
                  hasBlocks: section.blocks.length > 0,
                  onDelete: () => requestDeletePage(definition.id),
                  onRenamePage: (name) =>
                    requestRenamePage(definition.id, name),
                  repeat: definition.repeat ?? null,
                  candidates: repeatCandidates,
                  countBlockTitle: countBlock
                    ? getBlockDisplayLabel(countBlock)
                    : null,
                  warning: repeatIssue
                    ? t(repeatIssueMessageKeys[repeatIssue.code])
                    : null,
                  onToggleRepeat: (enabled) =>
                    requestSetPageRepeat(
                      definition.id,
                      enabled && repeatCandidates.length > 0
                        ? { countBlockId: repeatCandidates[0].id }
                        : null,
                    ),
                  onPickCountBlock: (blockId) =>
                    requestSetPageRepeat(definition.id, {
                      countBlockId: blockId,
                    }),
                }}
              />
            ) : (
              <PageHeaderRow
                label={t("formPages.pageLabel", { number: number ?? 0 })}
                name={definition.name ?? null}
                canDelete={sectionIndex > 0 || !otherPagesExist}
                hasBlocks={section.blocks.length > 0}
                onDelete={() => requestDeletePage(definition.id)}
                onRenamePage={(name) => requestRenamePage(definition.id, name)}
                repeat={definition.repeat ?? null}
                candidates={repeatCandidates}
                countBlockTitle={
                  countBlock ? getBlockDisplayLabel(countBlock) : null
                }
                warning={
                  repeatIssue
                    ? t(repeatIssueMessageKeys[repeatIssue.code])
                    : null
                }
                onToggleRepeat={(enabled) =>
                  requestSetPageRepeat(
                    definition.id,
                    enabled && repeatCandidates.length > 0
                      ? { countBlockId: repeatCandidates[0].id }
                      : null,
                  )
                }
                onPickCountBlock={(blockId) =>
                  requestSetPageRepeat(definition.id, { countBlockId: blockId })
                }
              />
            )
          ) : null}
          {section.blocks.length === 0 ? (
            <BlockInsertionDivider
              busy={busy}
              onAddBlock={insertAtGap(0)}
              onNewPage={null}
            />
          ) : (
            section.blocks.map((block, blockIndex) => (
              <Fragment key={block.id}>
                {sortable ? (
                  <SortableBlockRow
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
                ) : (
                  <StaticBlockRow
                    block={block}
                    selected={
                      selection.kind === "block" &&
                      selection.blockId === block.id
                    }
                    onSelect={(blockId) =>
                      requestPendingNavigation({ kind: "block", blockId })
                    }
                  />
                )}
                <BlockInsertionDivider
                  busy={busy}
                  onAddBlock={insertAtGap(blockIndex + 1)}
                  onNewPage={
                    blockIndex < section.blocks.length - 1 || isLastSection
                      ? () => requestNewPageAfter(block.id)
                      : null
                  }
                />
              </Fragment>
            ))
          )}
        </Fragment>
      );
    });
  }

  const shareHref = `/f/${form.slug}`;
  const isImmersiveGraphPage = builderMode === "graph";

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
        open={blockIdPendingDelete !== null}
        onClose={() => setBlockIdPendingDelete(null)}
        title={t("builder.deleteBlockTitle")}
        description={t("builder.deleteBlockDescription")}
        confirmLabel={t("ui.delete")}
        cancelLabel={t("ui.cancel")}
        pending={busy === `delete-${blockIdPendingDelete}`}
        onConfirm={confirmDeleteBlock}
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
        {isImmersiveGraphPage ? null : (
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
          <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-[var(--ink)]">
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
          <div className="rounded-[10px] border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-sm text-[var(--ink)]">
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
            immersiveInspectorOpen={graphSelectedBlockId !== null}
            immersiveFormTitle={form.title}
            onCloseImmersiveInspector={clearGraphSelection}
            onClearSelection={clearGraphSelection}
            overlay={
              <div className="fixed z-30 sm:right-4 sm:top-4">
                <Button variant="secondary" onClick={exitGraphMode}>
                  <ArrowLeft className="size-4" />
                  {t("builder.exitGraphMode")}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-8 lg:min-h-[calc(100vh-14rem)] lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="border-b border-[color:var(--line)] pb-6 lg:sticky lg:top-8 lg:flex lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[var(--ink)]">
                  {t("builder.blocks")}
                </h2>
                <div className="flex items-center gap-2">
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
                  {/* The menu renders in a portal, so the sidebar's overflow
                      does not clip it. */}
                  <Popover
                    open={isBlockMenuOpen}
                    onOpenChange={setIsBlockMenuOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        size="icon"
                        aria-label={t("builder.newBlock")}
                        title={t("builder.newBlock")}
                      >
                        <Plus size={18} color="var(--bg)" strokeWidth={2.5} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="max-h-[var(--radix-popover-content-available-height)] w-auto min-w-[220px] overflow-y-auto rounded-[10px] bg-[var(--bg-strong)] p-2 shadow-[var(--shadow-elevated)]"
                    >
                      <BlockTypeMenu
                        busy={busy}
                        onSelect={(type) =>
                          requestPendingNavigation({
                            kind: "add-block",
                            blockType: type,
                          })
                        }
                      />
                    </PopoverContent>
                  </Popover>
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
                        items={sections.flatMap((section) => [
                          ...(section.definition
                            ? [`page:${section.definition.id}`]
                            : []),
                          ...section.blocks.map((block) => block.id),
                        ])}
                        strategy={verticalListSortingStrategy}
                      >
                        {renderBlockList(true)}
                      </SortableContext>
                    </DndContext>
                  ) : (
                    renderBlockList(false)
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
                  saveWebhook={saveWebhook}
                  deleteWebhook={deleteWebhook}
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
