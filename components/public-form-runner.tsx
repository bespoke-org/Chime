"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Circle,
  CornerDownLeft,
  LoaderCircle,
  Square,
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
import { validateAndNormalizeAnswer } from "@/lib/answer-validation";
import {
  AGREEMENT_ANSWER_VALUES,
  type AgreementBlockConfig,
  type ChoiceBlockConfig,
  type LinkBlockConfig,
  type LongTextBlockConfig,
  type NumberBlockConfig,
  type ShortTextBlockConfig,
  type TextBlockConfig,
} from "@/lib/blocks";
import { resolveNextBlockId } from "@/lib/branching";
import type { AnswerValue, PublicForm, PublicBlock } from "@/lib/form-types";
import {
  isLegacyDefaultCompletionMessage,
  isLegacyDefaultCompletionTitle,
} from "@/lib/form-defaults";
import {
  createPublicFormDraft,
  getPublicFormDraftStorageKey,
  readStoredPublicFormDraft,
  removeStoredPublicFormDraft,
  validatePublicFormDraft,
  writeStoredPublicFormDraft,
} from "@/lib/public-form-draft";
import {
  advanceRunnerRoute,
  createInitialRunnerRoute,
  getCurrentRouteBlockId,
  getRouteCursor,
  getVisibleRouteTotal,
  hasRunnerProgress,
  retreatRunnerRoute,
} from "@/lib/public-form-runner-state";
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

async function submitResponse(
  slug: string,
  answers: Record<string, AnswerValue>,
) {
  const response = await fetch(`/api/public/forms/${slug}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ answers }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    responseId?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not submit response.");
  }

  return payload.responseId;
}

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

function isTextLikeBlock(
  block: PublicBlock | null,
): block is Extract<
  PublicBlock,
  { type: "SHORT_TEXT" | "LONG_TEXT" | "NUMBER" | "LINK" | "DATE" }
> {
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

function ShortcutBadge({ shortcut }: { shortcut: string }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--muted)]">
      {shortcut}
    </span>
  );
}

export function PublicFormRunner({ form }: { form: PublicForm }) {
  const initialRoute = useMemo(
    () => createInitialRunnerRoute(form.blocks),
    [form.blocks],
  );
  const storageKey = useMemo(
    () => getPublicFormDraftStorageKey(form.id),
    [form.id],
  );
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [route, setRoute] = useState(initialRoute);
  const { toasts, showToast, dismissToast } = useLocalToasts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasResolvedDraft, setHasResolvedDraft] = useState(false);
  const submitLockRef = useRef(false);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  );
  const currentBlockIdRef = useRef<string | null>(null);
  const currentBlockIsTextLikeRef = useRef(false);
  const pendingFocusBlockIdRef = useRef<string | null>(null);
  const focusInputNode = useCallback(
    (node: HTMLInputElement | HTMLTextAreaElement | null) => {
      activeInputRef.current = node;

      if (!node || isComplete || isSubmitting) {
        return;
      }

      const requestFrame =
        globalThis.requestAnimationFrame ??
        ((callback: FrameRequestCallback) =>
          window.setTimeout(() => callback(Date.now()), 0));

      requestFrame(() => {
        if (activeInputRef.current !== node) {
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
  const setActiveInputNode = useCallback(
    (node: HTMLInputElement | null) => {
      activeInputRef.current = node;

      if (!node || !currentBlockIsTextLikeRef.current) {
        return;
      }

      if (pendingFocusBlockIdRef.current !== currentBlockIdRef.current) {
        return;
      }

      focusInputNode(node);
    },
    [focusInputNode],
  );
  const setActiveTextareaNode = useCallback(
    (node: HTMLTextAreaElement | null) => {
      activeInputRef.current = node;

      if (!node || !currentBlockIsTextLikeRef.current) {
        return;
      }

      if (pendingFocusBlockIdRef.current !== currentBlockIdRef.current) {
        return;
      }

      focusInputNode(node);
    },
    [focusInputNode],
  );
  const answersRef = useRef<Record<string, AnswerValue>>(answers);

  const blocksById = useMemo(
    () => new Map(form.blocks.map((block) => [block.id, block])),
    [form.blocks],
  );
  const history = route.history;
  const cursor = getRouteCursor(route);
  const currentBlockId = getCurrentRouteBlockId(route, form.blocks);
  const currentBlock = currentBlockId
    ? (blocksById.get(currentBlockId) ?? null)
    : null;
  const nextBlockId = currentBlock
    ? resolveNextBlockId(form.blocks, currentBlock.id, answers)
    : null;

  currentBlockIdRef.current = currentBlock?.id ?? null;
  currentBlockIsTextLikeRef.current = isTextLikeBlock(currentBlock);
  const visibleTotal = useMemo(
    () =>
      getVisibleRouteTotal({
        blocks: form.blocks,
        currentBlockId,
        answers,
        cursor,
      }),
    [answers, currentBlockId, cursor, form.blocks],
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
  const allowBackNavigation = form.allowBackNavigation;

  function setAnswer(blockId: string, value: AnswerValue) {
    setAnswers((current) => ({
      ...current,
      [blockId]: value,
    }));
  }

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

    const validatedDraft = validatePublicFormDraft(form, storedDraft.draft);

    if (validatedDraft.status === "restored") {
      setAnswers(validatedDraft.draft.answers);
      setRoute({
        history: validatedDraft.draft.history,
        cursor: validatedDraft.draft.cursor,
      });
      showToast(t("publicRunner.progressRestored"));
    } else {
      removeStoredPublicFormDraft(storageKey);
      showToast(t("publicRunner.savedProgressDiscarded"), "error");
    }

    setHasResolvedDraft(true);
  }, [form, showToast, storageKey, t]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

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
          answers,
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
    storageKey,
  ]);

  useLayoutEffect(() => {
    if (
      !hasResolvedDraft ||
      isComplete ||
      isSubmitting ||
      !isTextLikeBlock(currentBlock)
    ) {
      return;
    }

    if (currentBlockId) {
      pendingFocusBlockIdRef.current = currentBlockId;
    }
    focusInputNode(activeInputRef.current);

    const timeoutId = window.setTimeout(() => {
      focusInputNode(activeInputRef.current);
      pendingFocusBlockIdRef.current = null;
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentBlock,
    currentBlockId,
    focusInputNode,
    hasResolvedDraft,
    isComplete,
    isSubmitting,
  ]);

  const validateStep = useCallback(
    (answerSet: Record<string, AnswerValue> = answers) => {
      if (!currentBlock || currentBlock.type === "TEXT") {
        return true;
      }

      const result = validateAndNormalizeAnswer(
        currentBlock,
        answerSet[currentBlock.id],
      );

      if (result.ok) {
        return true;
      }

      switch (result.error.code) {
        case "answer_required":
          showToast(t("publicRunner.answerRequired"), "error");
          return false;
        case "single_choice_required":
          showToast(t("publicRunner.singleChoiceRequired"), "error");
          return false;
        case "multi_choice_required":
          showToast(t("publicRunner.multiChoiceRequired"), "error");
          return false;
        case "invalid_option":
          showToast(
            t(
              currentBlock.type === "MULTIPLE_CHOICE"
                ? "publicRunner.multiChoiceRequired"
                : "publicRunner.singleChoiceRequired",
            ),
            "error",
          );
          return false;
        case "agreement_required":
        case "invalid_agreement":
          showToast(t("publicRunner.agreementRequired"), "error");
          return false;
        case "invalid_text_format":
          showToast(t("publicRunner.invalidTextFormat"), "error");
          return false;
        case "invalid_number":
          showToast(t("publicRunner.invalidNumber"), "error");
          return false;
        case "whole_number_required":
          showToast(t("publicRunner.wholeNumberRequired"), "error");
          return false;
        case "number_below_min":
          showToast(
            t("publicRunner.numberAtLeast", { min: result.error.min }),
            "error",
          );
          return false;
        case "number_above_max":
          showToast(
            t("publicRunner.numberAtMost", { max: result.error.max }),
            "error",
          );
          return false;
        case "invalid_link":
          showToast(t("publicRunner.invalidLink"), "error");
          return false;
        case "invalid_date":
          showToast(t("publicRunner.invalidDate"), "error");
          return false;
      }
    },
    [answers, currentBlock, showToast, t],
  );

  const handleContinue = useCallback(
    async (answerSet: Record<string, AnswerValue> = answers) => {
      if (!validateStep(answerSet) || !currentBlock) {
        return;
      }

      const sourceBlockId = currentBlock.id;
      const resolvedNextBlockId = resolveNextBlockId(
        form.blocks,
        sourceBlockId,
        answerSet,
      );

      if (!resolvedNextBlockId) {
        if (submitLockRef.current) {
          return;
        }

        submitLockRef.current = true;

        try {
          setIsSubmitting(true);
          await submitResponse(form.slug, answerSet);
          removeStoredPublicFormDraft(storageKey);
          setIsComplete(true);
        } catch (caughtError) {
          showToast(
            caughtError instanceof Error
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

      pendingFocusBlockIdRef.current = resolvedNextBlockId;

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setRoute((current) =>
        advanceRunnerRoute(current, sourceBlockId, resolvedNextBlockId),
      );
    },
    [
      answers,
      currentBlock,
      form.blocks,
      form.slug,
      showToast,
      storageKey,
      t,
      validateStep,
    ],
  );

  const handleBack = useCallback(() => {
    setRoute((current) => retreatRunnerRoute(current, { allowBackNavigation }));
  }, [allowBackNavigation]);

  const applyChoiceShortcut = useCallback(
    (shortcutIndex: number) => {
      if (
        !currentBlock ||
        (currentBlock.type !== "SINGLE_CHOICE" &&
          currentBlock.type !== "MULTIPLE_CHOICE" &&
          currentBlock.type !== "AGREEMENT")
      ) {
        return null;
      }

      if (currentBlock.type === "AGREEMENT") {
        if (shortcutIndex !== 0) {
          return null;
        }

        const isSelected =
          answers[currentBlock.id] === AGREEMENT_ANSWER_VALUES.AGREED;

        return {
          ...answers,
          [currentBlock.id]: isSelected ? "" : AGREEMENT_ANSWER_VALUES.AGREED,
        };
      }

      const options = (currentBlock.config as ChoiceBlockConfig).options;
      const option = options[shortcutIndex];

      if (!option) {
        return null;
      }

      if (currentBlock.type === "SINGLE_CHOICE") {
        return {
          ...answers,
          [currentBlock.id]: option,
        };
      }

      const rawValues = answers[currentBlock.id];
      const currentValues = Array.isArray(rawValues) ? rawValues : [];
      const nextValues = currentValues.includes(option)
        ? currentValues.filter((value) => value !== option)
        : [...currentValues, option];

      return {
        ...answers,
        [currentBlock.id]: nextValues,
      };
    },
    [answers, currentBlock],
  );

  function handleAdvanceKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
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
    if (!hasResolvedDraft || isComplete || isSubmitting || !currentBlock) {
      return;
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const shortcutIndex = getShortcutIndex(event.key);

      if (shortcutIndex !== null && !isTextEntryTarget(event.target)) {
        const nextAnswers = applyChoiceShortcut(shortcutIndex);

        if (nextAnswers) {
          event.preventDefault();
          setAnswers(nextAnswers);
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
    currentBlock,
    handleBack,
    handleContinue,
    hasResolvedDraft,
    isComplete,
    isSubmitting,
  ]);

  if (isComplete) {
    return (
      <Card className="w-full max-w-3xl overflow-hidden">
        <div className="border-b border-[color:var(--line)] bg-[var(--accent-soft)]/55 px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">
            {t("publicRunner.responseReceived")}
          </p>
        </div>
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <h2 className="max-w-2xl font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
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
                  className: "w-fit !bg-[var(--ink)] !text-[var(--bg)]",
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

  if (!currentBlock) {
    return null;
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <Card className="w-full max-w-5xl overflow-hidden">
        <div className="border-b border-[color:var(--line)] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-2xl leading-tight text-[var(--ink)] sm:text-3xl">
                {form.title}
              </h1>
            </div>

            {form.showProgress ? (
              <div className="w-full max-w-xs shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-ink)]">
                    {t("publicRunner.step", {
                      current: cursor + 1,
                      total: visibleTotal,
                    })}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-strong)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--accent)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 130, damping: 20 }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-6 sm:px-6 sm:py-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentBlock.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              onAnimationComplete={() => {
                if (isTextLikeBlock(currentBlock) && currentBlockId) {
                  pendingFocusBlockIdRef.current = currentBlockId;
                  focusInputNode(activeInputRef.current);
                }
              }}
              className="min-h-[280px]"
            >
              {currentBlock.type === "TEXT" ? (
                <div className="flex min-h-[240px] flex-col justify-center py-4">
                  <h2 className="font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
                    {currentBlock.title || t("publicRunner.defaultTextTitle")}
                  </h2>
                  <AuthoredMarkdown
                    content={(currentBlock.config as TextBlockConfig).body}
                    className="mt-4 text-base leading-7 text-[var(--ink)]/82"
                  />
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col justify-center py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {currentBlock.required ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-ink)]">
                        {t("publicRunner.required")}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
                    {currentBlock.title}
                  </h2>
                  {currentBlock.description ? (
                    <AuthoredMarkdown
                      content={currentBlock.description}
                      className="mt-3 text-base leading-7 text-[var(--muted)]"
                    />
                  ) : null}

                  <div className="mt-6 space-y-3">
                    {currentBlock.type === "SINGLE_CHOICE" ? (
                      <p className="text-sm font-medium text-[var(--muted)]">
                        {t("publicRunner.chooseOne")}
                      </p>
                    ) : null}

                    {currentBlock.type === "MULTIPLE_CHOICE" ? (
                      <p className="text-sm font-medium text-[var(--muted)]">
                        {t("publicRunner.selectAll")}
                      </p>
                    ) : null}

                    {currentBlock.type === "SHORT_TEXT" ? (
                      <Input
                        ref={setActiveInputNode}
                        autoFocus={
                          hasResolvedDraft && !isSubmitting && !isComplete
                        }
                        className="h-12 text-base placeholder:text-[var(--muted)]/65"
                        placeholder={
                          (currentBlock.config as ShortTextBlockConfig)
                            .placeholder
                        }
                        value={
                          typeof answers[currentBlock.id] === "string"
                            ? answers[currentBlock.id]
                            : ""
                        }
                        onChange={(event) =>
                          setAnswer(currentBlock.id, event.target.value)
                        }
                        onKeyDown={handleAdvanceKeyDown}
                      />
                    ) : null}

                    {currentBlock.type === "LONG_TEXT" ? (
                      <Textarea
                        ref={setActiveTextareaNode}
                        autoFocus={
                          hasResolvedDraft && !isSubmitting && !isComplete
                        }
                        className="min-h-[140px] text-base placeholder:text-[var(--muted)]/65"
                        placeholder={
                          (currentBlock.config as LongTextBlockConfig)
                            .placeholder
                        }
                        value={
                          typeof answers[currentBlock.id] === "string"
                            ? answers[currentBlock.id]
                            : ""
                        }
                        onChange={(event) =>
                          setAnswer(currentBlock.id, event.target.value)
                        }
                        onKeyDown={(event) =>
                          handleAdvanceKeyDown(event, { allowShiftEnter: true })
                        }
                      />
                    ) : null}

                    {currentBlock.type === "NUMBER" ? (
                      <Input
                        ref={setActiveInputNode}
                        autoFocus={
                          hasResolvedDraft && !isSubmitting && !isComplete
                        }
                        type="number"
                        step={
                          (currentBlock.config as NumberBlockConfig).allowFloat
                            ? "any"
                            : "1"
                        }
                        className="h-12 text-base placeholder:text-[var(--muted)]/65"
                        placeholder={
                          (currentBlock.config as NumberBlockConfig).placeholder
                        }
                        value={
                          typeof answers[currentBlock.id] === "string"
                            ? answers[currentBlock.id]
                            : ""
                        }
                        onChange={(event) =>
                          setAnswer(currentBlock.id, event.target.value)
                        }
                        onKeyDown={handleAdvanceKeyDown}
                      />
                    ) : null}

                    {currentBlock.type === "LINK" ? (
                      <Input
                        ref={setActiveInputNode}
                        autoFocus={
                          hasResolvedDraft && !isSubmitting && !isComplete
                        }
                        type="url"
                        className="h-12 text-base placeholder:text-[var(--muted)]/65"
                        placeholder={
                          (currentBlock.config as LinkBlockConfig).placeholder
                        }
                        value={
                          typeof answers[currentBlock.id] === "string"
                            ? answers[currentBlock.id]
                            : ""
                        }
                        onChange={(event) =>
                          setAnswer(currentBlock.id, event.target.value)
                        }
                        onKeyDown={handleAdvanceKeyDown}
                      />
                    ) : null}

                    {currentBlock.type === "DATE"
                      ? (() => {
                          const currentValue = answers[currentBlock.id];

                          return (
                            <DatePickerInput
                              ref={setActiveInputNode}
                              autoFocus={
                                hasResolvedDraft && !isSubmitting && !isComplete
                              }
                              className="text-base"
                              value={
                                typeof currentValue === "string"
                                  ? currentValue
                                  : ""
                              }
                              onChange={(value) =>
                                setAnswer(currentBlock.id, value)
                              }
                              onKeyDown={handleAdvanceKeyDown}
                              openCalendarLabel={t("publicRunner.openCalendar")}
                            />
                          );
                        })()
                      : null}

                    {currentBlock.type === "SINGLE_CHOICE" ? (
                      <div className="grid gap-3">
                        {(currentBlock.config as ChoiceBlockConfig).options.map(
                          (option, index) => {
                            const selected =
                              answers[currentBlock.id] === option;
                            const shortcut = getShortcutKey(index);

                            return (
                              <button
                                key={option}
                                type="button"
                                data-runner-choice-control="true"
                                aria-pressed={selected}
                                aria-keyshortcuts={shortcut ?? undefined}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition",
                                  selected
                                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[var(--shadow-accent)]"
                                    : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                                )}
                                onPointerDown={preventPointerFocusSteal}
                                onClick={() =>
                                  setAnswer(currentBlock.id, option)
                                }
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

                    {currentBlock.type === "MULTIPLE_CHOICE" ? (
                      <div className="grid gap-3">
                        {(currentBlock.config as ChoiceBlockConfig).options.map(
                          (option, index) => {
                            const rawValues = answers[currentBlock.id];
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
                                aria-pressed={selected}
                                aria-keyshortcuts={shortcut ?? undefined}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition",
                                  selected
                                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[var(--shadow-accent)]"
                                    : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                                )}
                                onPointerDown={preventPointerFocusSteal}
                                onClick={() => {
                                  const nextValues = selected
                                    ? currentValues.filter(
                                        (value) => value !== option,
                                      )
                                    : [...currentValues, option];
                                  setAnswer(currentBlock.id, nextValues);
                                }}
                                onKeyDown={handleChoiceControlKeyDown}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex size-5 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[var(--surface)]">
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

                    {currentBlock.type === "AGREEMENT" ? (
                      <div className="grid gap-3">
                        {(() => {
                          const selected =
                            answers[currentBlock.id] ===
                            AGREEMENT_ANSWER_VALUES.AGREED;
                          const label =
                            (currentBlock.config as AgreementBlockConfig)
                              .label ?? t("publicRunner.agree");
                          const nextValue = selected
                            ? ""
                            : AGREEMENT_ANSWER_VALUES.AGREED;

                          return (
                            <button
                              type="button"
                              data-runner-choice-control="true"
                              aria-pressed={selected}
                              aria-keyshortcuts="1"
                              className={cn(
                                "flex items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition",
                                selected
                                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[var(--shadow-accent)]"
                                  : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                              )}
                              onPointerDown={preventPointerFocusSteal}
                              onClick={() =>
                                setAnswer(currentBlock.id, nextValue)
                              }
                              onKeyDown={handleChoiceControlKeyDown}
                            >
                              <div className="flex items-center gap-3">
                                <span className="inline-flex size-5 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[var(--surface)]">
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
                </div>
              )}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {!nextBlockId
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
