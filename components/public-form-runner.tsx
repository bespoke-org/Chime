"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Circle,
  CornerDownLeft,
  LoaderCircle,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { AuthoredMarkdown } from "@/components/ui/authored-markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToastViewport } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { useLocalToasts } from "@/components/use-local-toasts";
import {
  validateAndNormalizeAnswer,
  type AnswerValidationError,
} from "@/lib/answer-validation";
import {
  AGREEMENT_ANSWER_VALUES,
  getRatingValues,
  type AgreementBlockConfig,
  type ChoiceBlockConfig,
  type FileUploadBlockConfig,
  type LinkBlockConfig,
  type LongTextBlockConfig,
  type NumberBlockConfig,
  type RatingBlockConfig,
  type ShortTextBlockConfig,
  type TextBlockConfig,
} from "@/lib/blocks";
import { getBlockDisplayLabel } from "@/lib/branching";
import { sendFormVisitEvent } from "@/lib/form-visit-tracking";
import type {
  AnswerValue,
  PublicForm,
  PublicBlock,
  StoredAnswerValue,
} from "@/lib/form-types";
import {
  createPublicFormDraft,
  createPublicFormDraftFingerprint,
  getPublicFormDraftStorageKey,
  readStoredPublicFormDraft,
  removeStoredPublicFormDraft,
  writeStoredPublicFormDraft,
  type PublicFormDraft,
} from "@/lib/public-form-draft";
import {
  advanceRunnerRoute,
  createInitialRunnerRoute,
  encodeRunnerRouteStep,
  getCurrentRouteStep,
  getExitProjectionIndex,
  getRouteCursor,
  getVisibleStepTotal,
  hasRunnerProgress,
  parseRunnerRouteStep,
  planPageInstances,
  resolveLandingPage,
  resolveNextRouteStep,
  retreatRunnerRoute,
  type RunnerRouteStep,
} from "@/lib/public-form-runner-state";
import {
  findPageByBlock,
  resolvePages,
  type PageDefinition,
  type ResolvedPage,
} from "@/lib/pages";
import {
  effectiveRepeatSettings,
  isNestedRepeatingAnswer,
  projectInstanceAnswers,
  validateAndNormalizeRepeatingAnswer,
} from "@/lib/repeat";
import { SUBMISSION_HONEYPOT_FIELD } from "@/lib/submission-guard";
import {
  BYTES_PER_MB,
  getAcceptAttribute,
  isContentTypeAllowed,
  normalizeContentType,
} from "@/lib/uploads";
import {
  isLegacyDefaultCompletionMessage,
  isLegacyDefaultCompletionTitle,
} from "@/lib/form-defaults";
import { cn } from "@/lib/utils";

const CHOICE_SHORTCUT_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
] as const;

class SubmitResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SubmitResponseError";
    this.status = status;
  }
}

async function submitResponse(
  slug: string,
  answers: Record<string, StoredAnswerValue>,
  guard: { honeypot: string; startedAt: number },
) {
  const response = await fetch(`/api/public/forms/${slug}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      answers,
      [SUBMISSION_HONEYPOT_FIELD]: guard.honeypot,
      startedAt: guard.startedAt,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    responseId?: string;
  };

  if (!response.ok) {
    throw new SubmitResponseError(
      payload.error ?? "Could not submit response.",
      response.status,
    );
  }

  return payload.responseId;
}

class UploadRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadRequestError";
    this.status = status;
  }
}

// Asks the app for a presigned URL, then sends the bytes straight to object
// storage. Returns the upload id that becomes the answer.
async function uploadFile(
  slug: string,
  blockId: string,
  file: File,
  contentType: string,
) {
  const response = await fetch(`/api/public/forms/${slug}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blockId,
      filename: file.name,
      contentType,
      size: file.size,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    uploadId?: string;
    url?: string;
    headers?: Record<string, string>;
  };

  if (!response.ok || !payload.uploadId || !payload.url) {
    throw new UploadRequestError(
      payload.error ?? "Could not upload file.",
      response.status,
    );
  }

  const put = await fetch(payload.url, {
    method: "PUT",
    headers: payload.headers ?? {},
    body: file,
  });

  if (!put.ok) {
    throw new UploadRequestError("Could not upload file.", put.status);
  }

  return payload.uploadId;
}

const fileHintKeys = {
  any: "publicRunner.fileHintAny",
  images: "publicRunner.fileHintImages",
  documents: "publicRunner.fileHintDocuments",
} as const;

function getShortcutKey(index: number) {
  return CHOICE_SHORTCUT_KEYS[index] ?? null;
}

function getShortcutIndex(key: string) {
  if (key === "0") {
    return 9;
  }

  if (!/^[1-9]$/.test(key)) {
    return null;
  }

  return Number(key) - 1;
}

// Digit keys select the rating with that value; "0" selects 10 when the
// scale reaches 10 (like the tenth choice option), otherwise the value 0.
function getRatingShortcutValue(
  shortcutIndex: number,
  config: RatingBlockConfig,
) {
  const value = shortcutIndex + 1;

  if (value >= config.min && value <= config.max) {
    return value;
  }

  return value === 10 && config.min === 0 ? 0 : null;
}

function getRatingShortcutKey(value: number, config: RatingBlockConfig) {
  if (value >= 1 && value <= 9) {
    return String(value);
  }

  if (value === 10 || (value === 0 && config.max < 10)) {
    return "0";
  }

  return null;
}

function isTextLikeBlock(block: PublicBlock | null): boolean {
  return (
    block?.type === "SHORT_TEXT" ||
    block?.type === "LONG_TEXT" ||
    block?.type === "NUMBER" ||
    block?.type === "LINK" ||
    block?.type === "DATE"
  );
}

function isTextEntryTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

function isRunnerChoiceControlTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest('[data-runner-choice-control="true"]') !== null
  );
}

function isGlobalAdvanceBlockedTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "BUTTON" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

type RunnerTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

// The existing per-block error copy, reused for every block of a page: when a
// page is submitted, each block is checked in saved order and the first
// invalid one reports with its own message.
function getBlockErrorMessage(
  block: PublicBlock,
  error: AnswerValidationError,
  t: RunnerTranslate,
) {
  switch (error.code) {
    case "answer_required":
      return t(
        block.type === "RATING"
          ? "publicRunner.ratingRequired"
          : block.type === "FILE_UPLOAD"
            ? "publicRunner.fileRequired"
            : "publicRunner.answerRequired",
      );
    case "invalid_file":
      return t("publicRunner.fileInvalid");
    case "single_choice_required":
      return t("publicRunner.singleChoiceRequired");
    case "multi_choice_required":
      return t("publicRunner.multiChoiceRequired");
    case "invalid_option":
      return t(
        block.type === "MULTIPLE_CHOICE"
          ? "publicRunner.multiChoiceRequired"
          : "publicRunner.singleChoiceRequired",
      );
    case "agreement_required":
    case "invalid_agreement":
      return t("publicRunner.agreementRequired");
    case "invalid_text_format":
      return t("publicRunner.invalidTextFormat");
    case "invalid_number":
      return t("publicRunner.invalidNumber");
    case "whole_number_required":
      return t("publicRunner.wholeNumberRequired");
    case "number_below_min":
      return t("publicRunner.numberAtLeast", { min: error.min });
    case "number_above_max":
      return t("publicRunner.numberAtMost", { max: error.max });
    case "invalid_link":
      return t("publicRunner.invalidLink");
    case "invalid_date":
      return t("publicRunner.invalidDate");
  }
}

function isChoiceShortcutBlock(block: PublicBlock) {
  return (
    block.type === "SINGLE_CHOICE" ||
    block.type === "MULTIPLE_CHOICE" ||
    block.type === "AGREEMENT" ||
    block.type === "RATING"
  );
}

// Text-like blocks carry the fields Enter walks through, in saved order.
function getFirstFieldBlockId(page: ResolvedPage) {
  return page.blocks.find(isTextLikeBlock)?.id ?? null;
}

function getNextFieldBlockId(page: ResolvedPage, blockId: string) {
  const currentIndex = page.blocks.findIndex((block) => block.id === blockId);

  if (currentIndex < 0) {
    return null;
  }

  for (let index = currentIndex + 1; index < page.blocks.length; index += 1) {
    if (isTextLikeBlock(page.blocks[index])) {
      return page.blocks[index].id;
    }
  }

  return null;
}

// The runner's answer state: flat for blocks of non-repeating pages, one
// entry per instance for blocks of a repeating page.
type RunnerAnswers = Record<string, StoredAnswerValue>;

// A repeating block's stored value as the per-instance array. A value that is
// still flat (a draft saved before the page was made repeating) keeps its
// whole value as instance 0.
function nestedInstances(
  block: PublicBlock,
  value: StoredAnswerValue | undefined,
): Array<AnswerValue | undefined> {
  if (value === undefined) {
    return [];
  }

  if (!isNestedRepeatingAnswer(block, value)) {
    return [value as AnswerValue];
  }

  return [...(value as Array<AnswerValue | undefined>)];
}

// The answers sent to the server and the draft: repeating blocks carry only
// the instances below the current count, normalized and trimmed of trailing
// unanswered ones; everything else stays as the respondent typed it.
function buildTrimmedAnswers(
  answerSet: RunnerAnswers,
  pages: ResolvedPage[],
): RunnerAnswers {
  const payload: RunnerAnswers = {};

  for (const [blockId, value] of Object.entries(answerSet)) {
    const page = findPageByBlock(pages, blockId);
    const block = page?.blocks.find((candidate) => candidate.id === blockId);

    if (!page || !block || !effectiveRepeatSettings(page, pages)) {
      payload[blockId] = value;
      continue;
    }

    const plan = planPageInstances(page, pages, answerSet);
    const result = validateAndNormalizeRepeatingAnswer(
      block,
      nestedInstances(block, value),
      plan.kind === "instances" ? plan.count : 0,
    );

    payload[blockId] = result.ok ? (result.values as StoredAnswerValue) : value;
  }

  return payload;
}

type RestoredRunnerDraft = {
  answers: RunnerAnswers;
  history: string[];
  cursor: number;
};

// Page-aware draft restore. The stored history holds route steps: the plain
// page id for instance 0, "<pageId>#<instanceIndex>" for later instances. A
// standalone block's page id EQUALS its block id (lib/pages.ts), so a draft
// route of block ids saved by an older session keeps resolving: every stored
// id is mapped to the page that contains it, and consecutive entries of one
// page (a block-per-step route from before that page existed) collapse into
// a single instance-0 step. Later instances must follow their predecessor and
// stay below the count the restored answers resolve to; page transitions must
// match a fresh walk, count-0 pages included.
function restoreRunnerDraft(
  form: PublicForm,
  pages: ResolvedPage[],
  draft: PublicFormDraft,
): RestoredRunnerDraft | null {
  if (
    draft.formId !== form.id ||
    draft.fingerprint !== createPublicFormDraftFingerprint(form)
  ) {
    return null;
  }

  const knownBlockIds = new Set(form.blocks.map((block) => block.id));
  const answers = Object.fromEntries(
    Object.entries(draft.answers).filter(([blockId]) =>
      knownBlockIds.has(blockId),
    ),
  ) as RunnerAnswers;

  if (!pages.length) {
    return draft.history.length === 0 && draft.cursor === 0
      ? { answers, history: [], cursor: 0 }
      : null;
  }

  if (draft.history.length === 0 || draft.cursor >= draft.history.length) {
    return null;
  }

  const activeHistory = draft.history.slice(0, draft.cursor + 1);
  const stepHistory: string[] = [];

  const resolveStepPage = (pageId: string) =>
    pages.some((page) => page.id === pageId)
      ? pageId
      : (findPageByBlock(pages, pageId)?.id ?? null);

  for (const entry of activeHistory) {
    const parsed = parseRunnerRouteStep(entry);

    if (!parsed) {
      return null;
    }

    const pageId = resolveStepPage(parsed.pageId);

    if (!pageId) {
      return null;
    }

    const step: RunnerRouteStep = {
      pageId,
      instanceIndex: parsed.instanceIndex,
    };
    const previousEntry = stepHistory[stepHistory.length - 1] ?? null;
    const previous = previousEntry ? parseRunnerRouteStep(previousEntry) : null;

    if (step.instanceIndex > 0) {
      const page = pages.find((candidate) => candidate.id === step.pageId);
      const plan = page ? planPageInstances(page, pages, answers) : null;

      if (
        plan?.kind !== "instances" ||
        step.instanceIndex >= plan.count ||
        !previous ||
        previous.pageId !== step.pageId ||
        previous.instanceIndex !== step.instanceIndex - 1
      ) {
        return null;
      }
    } else if (previous) {
      if (previous.pageId === step.pageId && previous.instanceIndex === 0) {
        continue;
      }

      const landing = resolveLandingPage({
        pages,
        exitPageId: previous.pageId,
        projectionIndex: getExitProjectionIndex({
          route: { history: stepHistory, cursor: stepHistory.length - 1 },
          pages,
        }),
        answers,
      });

      if (!landing || landing.pageId !== step.pageId) {
        return null;
      }
    } else if (step.pageId !== pages[0].id) {
      return null;
    }

    stepHistory.push(encodeRunnerRouteStep(step));
  }

  return {
    answers,
    history: stepHistory,
    cursor: stepHistory.length - 1,
  };
}

function ShortcutBadge({ shortcut }: { shortcut: string }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--muted)]">
      {shortcut}
    </span>
  );
}

// The number constraints the respondent should know before typing, shown
// only for the ends the block actually constrains. Validation repeats the
// same limits after Continue.
function NumberRangeHint({ config }: { config: NumberBlockConfig }) {
  const { t } = useI18n();
  const { min, max } = config;
  const text =
    min !== null && max !== null
      ? t("publicRunner.numberRangeHint", { min, max })
      : min !== null
        ? t("publicRunner.numberMinHint", { min })
        : max !== null
          ? t("publicRunner.numberMaxHint", { max })
          : null;

  if (text === null) {
    return null;
  }

  return <p className="text-sm text-[var(--muted)]">{text}</p>;
}

export function PublicFormRunner({
  form,
}: {
  // PublicForm gains `pages` with this change; forms without a page registry
  // (older callers, dev fixtures) resolve to one page per block.
  form: PublicForm & { pages?: PageDefinition[] };
}) {
  // Pages are resolved once per form version: blocks grouped by pageId in
  // saved order, a standalone block forming its own page.
  const pages = useMemo(
    () => resolvePages(form.blocks, form.pages),
    [form.blocks, form.pages],
  );
  const pagesById = useMemo(
    () => new Map(pages.map((page) => [page.id, page])),
    [pages],
  );
  const initialRoute = useMemo(() => createInitialRunnerRoute(pages), [pages]);
  const storageKey = useMemo(
    () => getPublicFormDraftStorageKey(form.id),
    [form.id],
  );
  const { t } = useI18n();
  const [answers, setAnswers] = useState<RunnerAnswers>({});
  const [route, setRoute] = useState(initialRoute);
  const [validatedStepKey, setValidatedStepKey] = useState<string | null>(null);
  const { toasts, showToast, dismissToast } = useLocalToasts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasResolvedDraft, setHasResolvedDraft] = useState(false);
  const [honeypotValue, setHoneypotValue] = useState("");
  // Filenames live only in memory: a restored draft shows a generic
  // "file attached" label for the stored upload id.
  const [attachedFilenames, setAttachedFilenames] = useState<
    Record<string, string>
  >({});
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());
  const submitLockRef = useRef(false);
  // The current step's text fields, keyed by block id: Enter walks them in
  // saved order, and focus restore targets the first one. Steps of one page
  // re-render the same block ids, so the nodes are replaced per instance.
  const blockNodesRef = useRef(new Map<string, HTMLDivElement>());
  const fieldNodesRef = useRef(
    new Map<string, HTMLInputElement | HTMLTextAreaElement>(),
  );
  const currentStepKeyRef = useRef<string | null>(null);
  const firstFieldBlockIdRef = useRef<string | null>(null);
  const pendingFocusStepKeyRef = useRef<string | null>(null);
  const focusPageField = useCallback(
    (blockId: string) => {
      if (isComplete || isSubmitting) {
        return;
      }

      const requestFrame =
        globalThis.requestAnimationFrame ??
        ((callback: FrameRequestCallback) =>
          window.setTimeout(() => callback(Date.now()), 0));

      requestFrame(() => {
        const node = fieldNodesRef.current.get(blockId);

        if (!node) {
          return;
        }

        node.focus();
        const value = "value" in node ? node.value : "";

        if (typeof value === "string") {
          const cursorPosition = value.length;
          node.setSelectionRange?.(cursorPosition, cursorPosition);
        }
      });
    },
    [isComplete, isSubmitting],
  );
  const registerFieldNode = useCallback(
    (blockId: string, node: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (node) {
        fieldNodesRef.current.set(blockId, node);

        // Inline ref callbacks re-run on every render, so an answer typed
        // into a later field re-attaches them too; the owed focus is only
        // for a step that just opened and must not take the focus back
        // from a field the respondent is already typing in.
        const active = document.activeElement;

        if (
          pendingFocusStepKeyRef.current === currentStepKeyRef.current &&
          blockId === firstFieldBlockIdRef.current &&
          (active === null || active === document.body)
        ) {
          focusPageField(blockId);
        }

        return;
      }

      fieldNodesRef.current.delete(blockId);
    },
    [focusPageField],
  );
  const answersRef = useRef<RunnerAnswers>(answers);

  const history = route.history;
  const cursor = getRouteCursor(route);
  const currentStep = getCurrentRouteStep(route, pages);
  const currentPageId = currentStep?.pageId ?? null;
  // The step as the route history and drafts encode it; instance 0 keeps the
  // plain page id, so pages without repeats keep today's keys.
  const currentStepKey = currentStep
    ? encodeRunnerRouteStep(currentStep)
    : null;
  const currentPage = currentPageId
    ? (pagesById.get(currentPageId) ?? null)
    : null;
  const currentInstanceIndex = currentStep?.instanceIndex ?? 0;
  const currentPlan = currentPage
    ? planPageInstances(currentPage, pages, answers)
    : null;
  const isRepeatingStep = currentPlan?.kind === "instances";
  const instanceCount = isRepeatingStep ? currentPlan.count : 0;
  // A named page shows its name as a small heading, so the respondent sees
  // the form move forward; an unnamed page looks as it did before.
  const pageName = currentPage?.definition?.name?.trim() || null;
  // The instance on screen reads and writes through a flat single-instance
  // view of the nested answers (lib/repeat.ts).
  const instanceAnswers = useMemo(
    () => projectInstanceAnswers(answers, pages, currentInstanceIndex),
    [answers, currentInstanceIndex, pages],
  );
  const firstFieldBlockId = currentPage
    ? getFirstFieldBlockId(currentPage)
    : null;
  // The count question's title names the blocked state; instances beyond a
  // blocked page keep whatever the respondent already answered.
  const blockedCountMessage = useMemo(() => {
    if (currentPlan?.kind !== "blocked" || !currentPage) {
      return null;
    }

    const settings = effectiveRepeatSettings(currentPage, pages);

    if (!settings) {
      return null;
    }

    const countBlock =
      findPageByBlock(pages, settings.countBlockId)?.blocks.find(
        (block) => block.id === settings.countBlockId,
      ) ?? null;

    if (!countBlock) {
      return null;
    }

    const question = getBlockDisplayLabel(countBlock);

    return currentPlan.status === "too_large"
      ? t("formPages.countTooLarge", {
          question,
          max: currentPlan.max,
        })
      : t("formPages.countMissing", { question });
  }, [currentPlan, currentPage, pages, t]);
  const hasFollowingStep = useMemo(
    () =>
      currentPage
        ? resolveNextRouteStep({
            pages,
            pageId: currentPage.id,
            instanceIndex: currentInstanceIndex,
            projectionIndex: getExitProjectionIndex({ route, pages }),
            answers,
          }) !== null
        : false,
    [answers, currentInstanceIndex, currentPage, pages, route],
  );

  currentStepKeyRef.current = currentStepKey;
  firstFieldBlockIdRef.current = firstFieldBlockId;
  const visibleTotal = useMemo(
    () => getVisibleStepTotal({ route, pages, answers }),
    [answers, pages, route],
  );
  const progress = useMemo(
    () => ((cursor + 1) / visibleTotal) * 100,
    [cursor, visibleTotal],
  );
  const completionTitle =
    !form.completionTitle.trim() ||
    isLegacyDefaultCompletionTitle(form.completionTitle)
      ? t("publicRunner.defaultCompletionTitle")
      : form.completionTitle.trim();
  const completionMessage =
    !form.completionMessage.trim() ||
    isLegacyDefaultCompletionMessage(form.completionMessage)
      ? t("publicRunner.defaultCompletionMessage")
      : form.completionMessage.trim();
  const completionLinkLabel = form.completionLinkLabel?.trim() || null;
  const completionLinkUrl = form.completionLinkUrl?.trim() || null;
  const closedMessage =
    form.closedMessage.trim() || t("publicRunner.defaultClosedMessage");
  const allowBackNavigation = form.allowBackNavigation;

  // Answers of a repeating page land in the block's per-instance array at the
  // instance on screen; instances beyond the current count stay in memory for
  // the session, so lowering and raising the count loses nothing.
  const setAnswer = useCallback(
    (blockId: string, value: AnswerValue) => {
      setAnswers((current) => {
        if (!isRepeatingStep) {
          return { ...current, [blockId]: value };
        }

        const block =
          currentPage?.blocks.find((candidate) => candidate.id === blockId) ??
          null;
        const instances = block ? nestedInstances(block, current[blockId]) : [];

        instances[currentInstanceIndex] = value;

        return { ...current, [blockId]: instances as StoredAnswerValue };
      });
    },
    [currentPage, currentInstanceIndex, isRepeatingStep],
  );

  const hasDraftProgress = useMemo(
    () =>
      hasRunnerProgress({
        answers,
        cursor,
        historyLength: history.length,
        initialHistoryLength: initialRoute.history.length,
      }),
    [answers, cursor, history.length, initialRoute.history.length],
  );

  useLayoutEffect(() => {
    const storedDraft = readStoredPublicFormDraft(storageKey);

    if (storedDraft.status !== "ok") {
      if (storedDraft.status === "invalid") {
        removeStoredPublicFormDraft(storageKey);
        showToast(t("publicRunner.savedProgressDiscarded"), "error");
      }

      setHasResolvedDraft(true);
      return;
    }

    const restoredDraft = restoreRunnerDraft(form, pages, storedDraft.draft);

    if (restoredDraft) {
      // The session began before this mount; otherwise a restored respondent
      // who finishes quickly looks like a bot to the minimum fill-time check.
      startedAtRef.current = Math.min(
        startedAtRef.current,
        storedDraft.draft.savedAt,
      );
      setAnswers(restoredDraft.answers);
      setRoute({
        history: restoredDraft.history,
        cursor: restoredDraft.cursor,
      });
      showToast(t("publicRunner.progressRestored"));
    } else {
      removeStoredPublicFormDraft(storageKey);
      showToast(t("publicRunner.savedProgressDiscarded"), "error");
    }

    setHasResolvedDraft(true);
  }, [form, pages, showToast, storageKey, t]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // The funnel counts a visitor once on open, once on the first answer or
  // step forward, and once on submission; all are fire-and-forget.
  const hasSentStartRef = useRef(false);

  useEffect(() => {
    sendFormVisitEvent(form.slug, "open");
  }, [form.slug]);

  useEffect(() => {
    if (!hasResolvedDraft || !hasDraftProgress || hasSentStartRef.current) {
      return;
    }

    hasSentStartRef.current = true;
    sendFormVisitEvent(form.slug, "start");
  }, [form.slug, hasDraftProgress, hasResolvedDraft]);

  useEffect(() => {
    if (!hasResolvedDraft || isComplete) {
      return;
    }

    if (!hasDraftProgress) {
      removeStoredPublicFormDraft(storageKey);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      writeStoredPublicFormDraft(
        storageKey,
        createPublicFormDraft(form, {
          answers: buildTrimmedAnswers(answers, pages),
          history,
          cursor,
        }),
      );
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    answers,
    cursor,
    form,
    hasDraftProgress,
    hasResolvedDraft,
    history,
    isComplete,
    pages,
    storageKey,
  ]);

  useLayoutEffect(() => {
    if (!hasResolvedDraft || isComplete || isSubmitting || !firstFieldBlockId) {
      return;
    }

    pendingFocusStepKeyRef.current = currentStepKey;
    focusPageField(firstFieldBlockId);

    const timeoutId = window.setTimeout(() => {
      const owedFocusStepKey = pendingFocusStepKeyRef.current;
      pendingFocusStepKeyRef.current = null;

      if (owedFocusStepKey === currentStepKey) {
        focusPageField(firstFieldBlockId);
      }
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentStepKey,
    firstFieldBlockId,
    focusPageField,
    hasResolvedDraft,
    isComplete,
    isSubmitting,
  ]);

  // One forward action per step: every block of the instance on screen is
  // validated with the existing per-block validation (per instance for a
  // repeating page). Errors remain next to their fields until corrected.
  const getCurrentStepErrors = useCallback(
    (answerSet: RunnerAnswers = answers) => {
      const errors: Record<string, AnswerValidationError> = {};

      if (!currentPage) {
        return errors;
      }

      const plan = planPageInstances(currentPage, pages, answerSet);

      for (const block of currentPage.blocks) {
        if (block.type === "TEXT") {
          continue;
        }

        // Only the instance on screen is validated: earlier instances were
        // checked when their own steps submitted.
        const result =
          plan.kind === "instances"
            ? validateAndNormalizeAnswer(
                block,
                nestedInstances(block, answerSet[block.id])[
                  currentInstanceIndex
                ],
              )
            : validateAndNormalizeAnswer(block, answerSet[block.id]);

        if (!result.ok) {
          errors[block.id] = result.error;
        }
      }

      return errors;
    },
    [answers, currentPage, currentInstanceIndex, pages],
  );
  const fieldErrors =
    validatedStepKey === currentStepKey ? getCurrentStepErrors() : {};

  function getFieldValidationProps(blockId: string) {
    return {
      "aria-invalid": Boolean(fieldErrors[blockId]),
      "aria-describedby": fieldErrors[blockId] ? `error-${blockId}` : undefined,
    };
  }

  const validateCurrentStep = useCallback(
    (answerSet: RunnerAnswers = answers) => {
      const errors = getCurrentStepErrors(answerSet);
      const firstInvalidBlockId = Object.keys(errors)[0];

      if (!firstInvalidBlockId) {
        setValidatedStepKey(null);
        return true;
      }

      setValidatedStepKey(currentStepKey);
      pendingFocusStepKeyRef.current = null;
      const blockNode = blockNodesRef.current.get(firstInvalidBlockId);
      blockNode?.scrollIntoView?.({ block: "center", behavior: "smooth" });

      if (fieldNodesRef.current.has(firstInvalidBlockId)) {
        focusPageField(firstInvalidBlockId);
      } else {
        blockNode
          ?.querySelector<HTMLElement>(
            "button:not(:disabled), input:not(:disabled)",
          )
          ?.focus({ preventScroll: true });
      }

      return false;
    },
    [answers, currentStepKey, focusPageField, getCurrentStepErrors],
  );

  const handleContinue = useCallback(
    async (answerSet: RunnerAnswers = answers) => {
      if (!currentPage || !currentStep) {
        return;
      }

      // A page whose count question has no usable answer shows its content
      // but cannot move forward.
      if (planPageInstances(currentPage, pages, answerSet).kind === "blocked") {
        return;
      }

      if (!validateCurrentStep(answerSet)) {
        return;
      }

      const sourceStepKey = encodeRunnerRouteStep(currentStep);
      const nextStep = resolveNextRouteStep({
        pages,
        pageId: currentPage.id,
        instanceIndex: currentStep.instanceIndex,
        projectionIndex: getExitProjectionIndex({ route, pages }),
        answers: answerSet,
      });

      if (!nextStep) {
        if (submitLockRef.current) {
          return;
        }

        submitLockRef.current = true;

        try {
          setIsSubmitting(true);
          await submitResponse(
            form.slug,
            buildTrimmedAnswers(answerSet, pages),
            {
              honeypot: honeypotValue,
              startedAt: startedAtRef.current,
            },
          );
          removeStoredPublicFormDraft(storageKey);
          sendFormVisitEvent(form.slug, "submit");
          setIsComplete(true);
        } catch (caughtError) {
          showToast(
            caughtError instanceof SubmitResponseError &&
              caughtError.status === 410
              ? closedMessage
              : caughtError instanceof SubmitResponseError &&
                  caughtError.status === 429
                ? t("publicRunner.tooManySubmissions")
                : caughtError instanceof Error
                  ? caughtError.message
                  : t("publicRunner.submitError"),
            "error",
          );
        } finally {
          setIsSubmitting(false);
          submitLockRef.current = false;
        }

        return;
      }

      const nextStepKey = encodeRunnerRouteStep(nextStep);

      pendingFocusStepKeyRef.current = nextStepKey;

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setRoute((current) =>
        advanceRunnerRoute(current, sourceStepKey, nextStepKey),
      );
    },
    [
      answers,
      closedMessage,
      currentPage,
      currentStep,
      form.slug,
      honeypotValue,
      pages,
      route,
      showToast,
      storageKey,
      t,
      validateCurrentStep,
    ],
  );

  const handleFileSelected = useCallback(
    async (block: PublicBlock, file: File | null) => {
      if (!file) {
        return;
      }

      const config = block.config as FileUploadBlockConfig;

      if (file.size > config.maxSizeMb * BYTES_PER_MB) {
        showToast(
          t("publicRunner.fileTooLarge", { size: config.maxSizeMb }),
          "error",
        );
        return;
      }

      // Browsers leave the type empty for unknown extensions.
      const contentType =
        normalizeContentType(file.type) ?? "application/octet-stream";

      if (!isContentTypeAllowed(contentType, config.accept)) {
        showToast(t("publicRunner.fileTypeNotAllowed"), "error");
        return;
      }

      setUploadingBlockId(block.id);

      try {
        const uploadId = await uploadFile(
          form.slug,
          block.id,
          file,
          contentType,
        );
        setAttachedFilenames((current) => ({
          ...current,
          [block.id]: file.name,
        }));
        setAnswer(block.id, uploadId);
      } catch (caughtError) {
        showToast(
          caughtError instanceof UploadRequestError &&
            caughtError.status === 503
            ? t("publicRunner.fileUploadUnavailable")
            : caughtError instanceof UploadRequestError &&
                caughtError.status === 429
              ? t("publicRunner.tooManyUploads")
              : caughtError instanceof UploadRequestError &&
                  caughtError.status === 422
                ? caughtError.message
                : t("publicRunner.fileUploadFailed"),
          "error",
        );
      } finally {
        setUploadingBlockId(null);
      }
    },
    [form.slug, setAnswer, showToast, t],
  );

  const handleBack = useCallback(() => {
    setValidatedStepKey(null);
    setRoute((current) => retreatRunnerRoute(current, { allowBackNavigation }));
  }, [allowBackNavigation]);

  // Digit shortcuts stay unambiguous: they drive the page's only choice
  // block. A page with a single choice block (every single-block page) keeps
  // exactly the old behavior; a page with several gets none. The shortcut
  // answers the instance on screen through the single-instance view.
  const choiceShortcutBlock = useMemo(() => {
    if (!currentPage) {
      return null;
    }

    const candidates = currentPage.blocks.filter(isChoiceShortcutBlock);

    return candidates.length === 1 ? candidates[0] : null;
  }, [currentPage]);

  const applyChoiceShortcut = useCallback(
    (shortcutIndex: number) => {
      const block = choiceShortcutBlock;

      if (!block) {
        return false;
      }

      if (block.type === "RATING") {
        const value = getRatingShortcutValue(
          shortcutIndex,
          block.config as RatingBlockConfig,
        );

        if (value === null) {
          return false;
        }

        setAnswer(block.id, String(value));
        return true;
      }

      if (block.type === "AGREEMENT") {
        if (shortcutIndex !== 0) {
          return false;
        }

        const isSelected =
          instanceAnswers[block.id] === AGREEMENT_ANSWER_VALUES.AGREED;

        setAnswer(block.id, isSelected ? "" : AGREEMENT_ANSWER_VALUES.AGREED);
        return true;
      }

      const options = (block.config as ChoiceBlockConfig).options;
      const option = options[shortcutIndex];

      if (!option) {
        return false;
      }

      if (block.type === "SINGLE_CHOICE") {
        setAnswer(block.id, option);
        return true;
      }

      const rawValues = instanceAnswers[block.id];
      const currentValues = Array.isArray(rawValues) ? rawValues : [];
      const nextValues = currentValues.includes(option)
        ? currentValues.filter((value) => value !== option)
        : [...currentValues, option];

      setAnswer(block.id, nextValues);
      return true;
    },
    [choiceShortcutBlock, instanceAnswers, setAnswer],
  );

  // Enter in a text field moves the focus to the next field of the page and
  // submits from the last one; long text keeps Shift+Enter for newlines.
  function handleFieldKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    blockId: string,
    options?: { allowShiftEnter?: boolean },
  ) {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      isSubmitting
    ) {
      return;
    }

    if (options?.allowShiftEnter && event.shiftKey) {
      return;
    }

    event.preventDefault();

    const nextFieldBlockId = currentPage
      ? getNextFieldBlockId(currentPage, blockId)
      : null;

    if (nextFieldBlockId) {
      pendingFocusStepKeyRef.current = null;
      focusPageField(nextFieldBlockId);
      return;
    }

    void handleContinue();
  }

  function preventPointerFocusSteal(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
  }

  function handleChoiceControlKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      isSubmitting
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void handleContinue(answersRef.current);
  }

  useEffect(() => {
    if (!hasResolvedDraft || isComplete || isSubmitting || !currentPage) {
      return;
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const shortcutIndex = getShortcutIndex(event.key);

      if (shortcutIndex !== null && !isTextEntryTarget(event.target)) {
        if (applyChoiceShortcut(shortcutIndex)) {
          event.preventDefault();
        }

        return;
      }

      if (
        event.key === "Enter" &&
        (isRunnerChoiceControlTarget(event.target) ||
          !isGlobalAdvanceBlockedTarget(event.target))
      ) {
        event.preventDefault();
        void handleContinue(answersRef.current);
        return;
      }

      if (event.key === "Escape" && cursor > 0 && allowBackNavigation) {
        event.preventDefault();
        handleBack();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [
    allowBackNavigation,
    applyChoiceShortcut,
    cursor,
    currentPage,
    handleBack,
    handleContinue,
    hasResolvedDraft,
    isComplete,
    isSubmitting,
  ]);

  if (isComplete) {
    return (
      <Card className="w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-sm text-[var(--muted)]">
            {t("publicRunner.responseReceived")}
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
            {completionTitle}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">
            {completionMessage}
          </p>
          {completionLinkLabel && completionLinkUrl ? (
            <div className="mt-8">
              <Link
                href={completionLinkUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: "default",
                  className: "w-fit",
                })}
              >
                {completionLinkLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </Card>
    );
  }

  if (!currentPage) {
    return null;
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <Card className="w-full max-w-5xl overflow-hidden">
        {/* Bots fill every field; people never see this one. */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden"
        >
          <input
            type="text"
            name={SUBMISSION_HONEYPOT_FIELD}
            data-testid="runner-honeypot"
            tabIndex={-1}
            autoComplete="off"
            value={honeypotValue}
            onChange={(event) => setHoneypotValue(event.target.value)}
          />
        </div>
        <div className="border-b border-[color:var(--line)] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-2xl leading-tight text-[var(--ink)] sm:text-3xl">
                {form.title}
              </h1>
            </div>

            {form.showProgress ? (
              <div className="w-full max-w-xs shrink-0">
                <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
                  <span>
                    {t("publicRunner.step", {
                      current: cursor + 1,
                      total: visibleTotal,
                    })}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-strong)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--accent)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-6 sm:px-6 sm:py-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepKey ?? currentPage.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              onAnimationComplete={() => {
                if (firstFieldBlockId && validatedStepKey !== currentStepKey) {
                  pendingFocusStepKeyRef.current = currentStepKey;
                  focusPageField(firstFieldBlockId);
                }
              }}
              className="min-h-[280px]"
            >
              {pageName || isRepeatingStep ? (
                <p className="mb-6">
                  <span className="inline-flex items-center rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-sm font-medium text-[var(--accent-ink)]">
                    {pageName}
                    {pageName && isRepeatingStep ? " · " : null}
                    {isRepeatingStep
                      ? t("formPages.instanceLabel", {
                          number: currentInstanceIndex + 1,
                          count: instanceCount,
                        })
                      : null}
                  </span>
                </p>
              ) : null}
              {blockedCountMessage ? (
                <p
                  role="alert"
                  className="mb-6 rounded-md border border-[color:var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--danger-ink)]"
                >
                  {blockedCountMessage}
                </p>
              ) : null}
              {currentPage.blocks.map((block, blockIndex) => (
                <div
                  key={block.id}
                  ref={(node) => {
                    if (node) {
                      blockNodesRef.current.set(block.id, node);
                    } else {
                      blockNodesRef.current.delete(block.id);
                    }
                  }}
                  className={blockIndex === 0 ? undefined : "mt-8"}
                >
                  {block.type === "TEXT" ? (
                    <div className="flex flex-col justify-center py-4">
                      <h2 className="font-display text-2xl leading-tight text-[var(--ink)] sm:text-3xl">
                        {block.title || t("publicRunner.defaultTextTitle")}
                      </h2>
                      <AuthoredMarkdown
                        content={(block.config as TextBlockConfig).body}
                        className="mt-4 text-base leading-7 text-[var(--ink)]/82"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center py-2">
                      <h2
                        id={`question-${block.id}`}
                        className="font-display text-2xl leading-tight text-[var(--ink)] sm:text-3xl"
                      >
                        {block.title}
                      </h2>
                      {block.description ? (
                        <AuthoredMarkdown
                          content={block.description}
                          className="mt-3 text-base leading-7 text-[var(--muted)]"
                        />
                      ) : null}
                      {block.required ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {t("publicRunner.required")}
                        </p>
                      ) : null}

                      <div
                        role="group"
                        aria-labelledby={`question-${block.id}`}
                        {...getFieldValidationProps(block.id)}
                        className={cn(
                          "mt-6 space-y-3",
                          fieldErrors[block.id] &&
                            "rounded-md outline-2 outline-offset-4 outline-[var(--danger-line)] [&_[aria-invalid=true]]:border-[var(--danger-ink)] [&_[aria-invalid=true]:focus]:ring-[var(--danger-soft)]",
                        )}
                      >
                        {block.type === "SHORT_TEXT" ? (
                          <Input
                            {...getFieldValidationProps(block.id)}
                            aria-labelledby={`question-${block.id}`}
                            ref={(node) => registerFieldNode(block.id, node)}
                            autoFocus={
                              hasResolvedDraft &&
                              !isSubmitting &&
                              !isComplete &&
                              block.id === firstFieldBlockId
                            }
                            className="h-12 text-base placeholder:text-[var(--muted)]/65"
                            placeholder={
                              (block.config as ShortTextBlockConfig).placeholder
                            }
                            value={
                              typeof instanceAnswers[block.id] === "string"
                                ? instanceAnswers[block.id]
                                : ""
                            }
                            onChange={(event) =>
                              setAnswer(block.id, event.target.value)
                            }
                            onKeyDown={(event) =>
                              handleFieldKeyDown(event, block.id)
                            }
                          />
                        ) : null}

                        {block.type === "LONG_TEXT" ? (
                          <Textarea
                            {...getFieldValidationProps(block.id)}
                            aria-labelledby={`question-${block.id}`}
                            ref={(node) => registerFieldNode(block.id, node)}
                            autoFocus={
                              hasResolvedDraft &&
                              !isSubmitting &&
                              !isComplete &&
                              block.id === firstFieldBlockId
                            }
                            className="min-h-[140px] text-base placeholder:text-[var(--muted)]/65"
                            placeholder={
                              (block.config as LongTextBlockConfig).placeholder
                            }
                            value={
                              typeof instanceAnswers[block.id] === "string"
                                ? instanceAnswers[block.id]
                                : ""
                            }
                            onChange={(event) =>
                              setAnswer(block.id, event.target.value)
                            }
                            onKeyDown={(event) =>
                              handleFieldKeyDown(event, block.id, {
                                allowShiftEnter: true,
                              })
                            }
                          />
                        ) : null}

                        {block.type === "NUMBER" ? (
                          <>
                            <Input
                              {...getFieldValidationProps(block.id)}
                              aria-labelledby={`question-${block.id}`}
                              ref={(node) => registerFieldNode(block.id, node)}
                              autoFocus={
                                hasResolvedDraft &&
                                !isSubmitting &&
                                !isComplete &&
                                block.id === firstFieldBlockId
                              }
                              // A number input swallows any non-numeric
                              // keystrokes: the browser keeps them out of
                              // value, the runner sees an empty answer and
                              // reports the wrong error. Text input passes
                              // the raw value to validation.
                              type="text"
                              inputMode={
                                (block.config as NumberBlockConfig).allowFloat
                                  ? "decimal"
                                  : "numeric"
                              }
                              className="h-12 text-base placeholder:text-[var(--muted)]/65"
                              placeholder={
                                (block.config as NumberBlockConfig).placeholder
                              }
                              value={
                                typeof instanceAnswers[block.id] === "string"
                                  ? instanceAnswers[block.id]
                                  : ""
                              }
                              onChange={(event) =>
                                setAnswer(block.id, event.target.value)
                              }
                              onKeyDown={(event) =>
                                handleFieldKeyDown(event, block.id)
                              }
                            />
                            <NumberRangeHint
                              config={block.config as NumberBlockConfig}
                            />
                          </>
                        ) : null}

                        {block.type === "LINK" ? (
                          <Input
                            {...getFieldValidationProps(block.id)}
                            aria-labelledby={`question-${block.id}`}
                            ref={(node) => registerFieldNode(block.id, node)}
                            autoFocus={
                              hasResolvedDraft &&
                              !isSubmitting &&
                              !isComplete &&
                              block.id === firstFieldBlockId
                            }
                            type="url"
                            className="h-12 text-base placeholder:text-[var(--muted)]/65"
                            placeholder={
                              (block.config as LinkBlockConfig).placeholder
                            }
                            value={
                              typeof instanceAnswers[block.id] === "string"
                                ? instanceAnswers[block.id]
                                : ""
                            }
                            onChange={(event) =>
                              setAnswer(block.id, event.target.value)
                            }
                            onKeyDown={(event) =>
                              handleFieldKeyDown(event, block.id)
                            }
                          />
                        ) : null}

                        {block.type === "DATE"
                          ? (() => {
                              const currentValue = instanceAnswers[block.id];

                              return (
                                <DatePickerInput
                                  {...getFieldValidationProps(block.id)}
                                  aria-labelledby={`question-${block.id}`}
                                  ref={(node) =>
                                    registerFieldNode(block.id, node)
                                  }
                                  autoFocus={
                                    hasResolvedDraft &&
                                    !isSubmitting &&
                                    !isComplete &&
                                    block.id === firstFieldBlockId
                                  }
                                  className="text-base"
                                  value={
                                    typeof currentValue === "string"
                                      ? currentValue
                                      : ""
                                  }
                                  onChange={(value) =>
                                    setAnswer(block.id, value)
                                  }
                                  onKeyDown={(event) =>
                                    handleFieldKeyDown(event, block.id)
                                  }
                                  openCalendarLabel={t(
                                    "publicRunner.openCalendar",
                                  )}
                                />
                              );
                            })()
                          : null}

                        {block.type === "SINGLE_CHOICE" ? (
                          <div className="inline-grid min-w-[33%] max-w-full gap-3 px-2 max-md:min-w-full">
                            {(block.config as ChoiceBlockConfig).options.map(
                              (option, index) => {
                                const selected =
                                  instanceAnswers[block.id] === option;
                                const shortcut = getShortcutKey(index);

                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    data-runner-choice-control="true"
                                    {...getFieldValidationProps(block.id)}
                                    aria-pressed={selected}
                                    aria-keyshortcuts={shortcut ?? undefined}
                                    className={cn(
                                      "flex w-full max-w-full items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition",
                                      selected
                                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                                        : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                                    )}
                                    onPointerDown={preventPointerFocusSteal}
                                    onClick={() => setAnswer(block.id, option)}
                                    onKeyDown={handleChoiceControlKeyDown}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex size-5 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--surface)]">
                                        {selected ? (
                                          <Check className="size-3.5 text-[var(--accent)]" />
                                        ) : (
                                          <Circle className="size-3.5 text-[var(--muted)]/55" />
                                        )}
                                      </span>
                                      <span>{option}</span>
                                    </div>
                                    {shortcut ? (
                                      <ShortcutBadge shortcut={shortcut} />
                                    ) : null}
                                  </button>
                                );
                              },
                            )}
                          </div>
                        ) : null}

                        {block.type === "MULTIPLE_CHOICE" ? (
                          <div className="inline-grid min-w-[33%] max-w-full gap-3 px-2 max-md:min-w-full">
                            {(block.config as ChoiceBlockConfig).options.map(
                              (option, index) => {
                                const rawValues = instanceAnswers[block.id];
                                const currentValues: string[] = Array.isArray(
                                  rawValues,
                                )
                                  ? rawValues
                                  : [];
                                const selected = currentValues.includes(option);
                                const shortcut = getShortcutKey(index);

                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    data-runner-choice-control="true"
                                    {...getFieldValidationProps(block.id)}
                                    aria-pressed={selected}
                                    aria-keyshortcuts={shortcut ?? undefined}
                                    className={cn(
                                      "flex w-full max-w-full items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition",
                                      selected
                                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                                        : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                                    )}
                                    onPointerDown={preventPointerFocusSteal}
                                    onClick={() => {
                                      const nextValues = selected
                                        ? currentValues.filter(
                                            (value) => value !== option,
                                          )
                                        : [...currentValues, option];
                                      setAnswer(block.id, nextValues);
                                    }}
                                    onKeyDown={handleChoiceControlKeyDown}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex size-5 items-center justify-center rounded-md border border-[color:var(--line)] bg-[var(--surface)]">
                                        {selected ? (
                                          <Check className="size-3.5 text-[var(--accent)]" />
                                        ) : (
                                          <Square className="size-3.5 text-[var(--muted)]/55" />
                                        )}
                                      </span>
                                      <span>{option}</span>
                                    </div>
                                    {shortcut ? (
                                      <ShortcutBadge shortcut={shortcut} />
                                    ) : null}
                                  </button>
                                );
                              },
                            )}
                          </div>
                        ) : null}

                        {block.type === "RATING"
                          ? (() => {
                              const config = block.config as RatingBlockConfig;
                              const currentValue = instanceAnswers[block.id];

                              return (
                                <div className="grid gap-2 px-2">
                                  <div className="flex flex-wrap gap-2">
                                    {getRatingValues(config).map((value) => {
                                      const selected =
                                        currentValue === String(value);
                                      const shortcut = getRatingShortcutKey(
                                        value,
                                        config,
                                      );

                                      return (
                                        <button
                                          key={value}
                                          type="button"
                                          data-runner-choice-control="true"
                                          {...getFieldValidationProps(block.id)}
                                          aria-pressed={selected}
                                          aria-keyshortcuts={
                                            shortcut ?? undefined
                                          }
                                          className={cn(
                                            "flex h-12 min-w-12 items-center justify-center rounded-md border px-3 text-base font-semibold transition",
                                            selected
                                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                                              : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                                          )}
                                          onPointerDown={
                                            preventPointerFocusSteal
                                          }
                                          onClick={() =>
                                            setAnswer(
                                              block.id,
                                              selected ? "" : String(value),
                                            )
                                          }
                                          onKeyDown={handleChoiceControlKeyDown}
                                        >
                                          {value}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {config.minLabel || config.maxLabel ? (
                                    <div className="flex justify-between gap-4 text-xs text-[var(--muted)]">
                                      <span>{config.minLabel}</span>
                                      <span className="text-right">
                                        {config.maxLabel}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()
                          : null}

                        {block.type === "FILE_UPLOAD"
                          ? (() => {
                              const config =
                                block.config as FileUploadBlockConfig;
                              const currentValue = instanceAnswers[block.id];
                              const attached =
                                typeof currentValue === "string" &&
                                currentValue;
                              const isUploading = uploadingBlockId === block.id;
                              const inputId = `file-${block.id}`;

                              return (
                                <div className="grid gap-3 px-2">
                                  {attached ? (
                                    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-[var(--ink)]">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <Paperclip className="size-4 shrink-0 text-[var(--accent)]" />
                                        <span className="truncate text-base">
                                          {attachedFilenames[block.id] ??
                                            t("publicRunner.fileAttached")}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        aria-label={t(
                                          "publicRunner.fileRemove",
                                        )}
                                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                                        onPointerDown={preventPointerFocusSteal}
                                        onClick={() => setAnswer(block.id, "")}
                                      >
                                        <X className="size-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <label
                                      htmlFor={inputId}
                                      className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-4 text-base text-[var(--ink)] transition hover:bg-[var(--surface)]",
                                        isUploading &&
                                          "pointer-events-none opacity-70",
                                      )}
                                    >
                                      {isUploading ? (
                                        <LoaderCircle className="size-4 animate-spin text-[var(--accent)]" />
                                      ) : (
                                        <Paperclip className="size-4 text-[var(--accent)]" />
                                      )}
                                      <span>
                                        {isUploading
                                          ? t("publicRunner.fileUploading")
                                          : t("publicRunner.chooseFile")}
                                      </span>
                                      <input
                                        id={inputId}
                                        type="file"
                                        {...getFieldValidationProps(block.id)}
                                        className="sr-only"
                                        accept={
                                          getAcceptAttribute(config.accept) ||
                                          undefined
                                        }
                                        disabled={isUploading}
                                        onChange={(event) => {
                                          const file =
                                            event.target.files?.[0] ?? null;
                                          event.target.value = "";
                                          void handleFileSelected(block, file);
                                        }}
                                      />
                                    </label>
                                  )}
                                  <p className="text-xs text-[var(--muted)]">
                                    {t(fileHintKeys[config.accept], {
                                      size: config.maxSizeMb,
                                    })}
                                  </p>
                                </div>
                              );
                            })()
                          : null}

                        {block.type === "AGREEMENT" ? (
                          <div className="inline-grid min-w-[33%] max-w-full gap-3 px-2 max-md:min-w-full">
                            {(() => {
                              const selected =
                                instanceAnswers[block.id] ===
                                AGREEMENT_ANSWER_VALUES.AGREED;
                              const label =
                                (block.config as AgreementBlockConfig).label ??
                                t("publicRunner.agree");
                              const nextValue = selected
                                ? ""
                                : AGREEMENT_ANSWER_VALUES.AGREED;

                              return (
                                <button
                                  type="button"
                                  data-runner-choice-control="true"
                                  {...getFieldValidationProps(block.id)}
                                  aria-pressed={selected}
                                  aria-keyshortcuts="1"
                                  className={cn(
                                    "flex w-full max-w-full items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition",
                                    selected
                                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                                      : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                                  )}
                                  onPointerDown={preventPointerFocusSteal}
                                  onClick={() => setAnswer(block.id, nextValue)}
                                  onKeyDown={handleChoiceControlKeyDown}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="inline-flex size-5 items-center justify-center rounded-md border border-[color:var(--line)] bg-[var(--surface)]">
                                      {selected ? (
                                        <Check className="size-3.5 text-[var(--accent)]" />
                                      ) : (
                                        <Square className="size-3.5 text-[var(--muted)]/55" />
                                      )}
                                    </span>
                                    <span>{label}</span>
                                  </div>
                                  <ShortcutBadge shortcut="1" />
                                </button>
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>
                      {fieldErrors[block.id] ? (
                        <p
                          id={`error-${block.id}`}
                          role="alert"
                          className="mt-3 text-sm text-[var(--danger-ink)]"
                        >
                          {getBlockErrorMessage(
                            block,
                            fieldErrors[block.id],
                            t,
                          )}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4">
            {allowBackNavigation ? (
              <Button
                variant="secondary"
                onPointerDown={preventPointerFocusSteal}
                onClick={handleBack}
                disabled={cursor === 0 || isSubmitting}
              >
                {t("publicRunner.back")}
                <span className="ml-1 inline-flex h-5 items-center rounded-md border border-current/20 bg-black/10 px-1.5 text-[10px] font-medium opacity-90 dark:bg-white/10">
                  Esc
                </span>
              </Button>
            ) : (
              <div />
            )}
            <Button
              onPointerDown={preventPointerFocusSteal}
              onClick={() => void handleContinue()}
              disabled={isSubmitting || blockedCountMessage !== null}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {!hasFollowingStep
                ? t("publicRunner.submit")
                : t("publicRunner.continue")}
              {!isSubmitting ? (
                <span className="ml-1 inline-flex h-5 items-center gap-1 rounded-md border border-current/20 bg-black/10 px-1.5 text-[10px] opacity-90 dark:bg-white/10">
                  <CornerDownLeft className="size-3" />
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
