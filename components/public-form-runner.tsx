"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle, CornerDownLeft, LoaderCircle, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { useI18n } from "@/components/i18n-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { ToastViewport, type ToastData } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import {
  AGREEMENT_ANSWER_VALUES,
  getTextValidationPattern,
  isValidDateAnswer,
  isValidLinkAnswer,
  parseNumericAnswer,
  type ChoiceBlockConfig,
  type LinkBlockConfig,
  type LongTextBlockConfig,
  type NumberBlockConfig,
  type ShortTextBlockConfig,
  type TextBlockConfig,
} from "@/lib/blocks";
import { resolveNextBlockId } from "@/lib/branching";
import { isLegacyDefaultCompletionMessage, isLegacyDefaultCompletionTitle } from "@/lib/form-defaults";
import type { PublicForm } from "@/lib/form-types";
import { cn } from "@/lib/utils";

async function submitResponse(slug: string, answers: Record<string, string | string[]>) {
  const response = await fetch(`/api/public/forms/${slug}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ answers }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string; responseId?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not submit response.");
  }

  return payload.responseId;
}

export function PublicFormRunner({ form }: { form: PublicForm }) {
  const initialHistory = useMemo(() => (form.blocks[0] ? [form.blocks[0].id] : []), [form.blocks]);
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [history, setHistory] = useState<string[]>(initialHistory);
  const [cursor, setCursor] = useState(0);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const blocksById = useMemo(() => new Map(form.blocks.map((block) => [block.id, block])), [form.blocks]);
  const currentBlockId = history[cursor] ?? initialHistory[0] ?? null;
  const currentBlock = currentBlockId ? blocksById.get(currentBlockId) ?? null : null;
  const nextBlockId = currentBlock ? resolveNextBlockId(form.blocks, currentBlock.id, answers) : null;
  const visibleTotal = Math.max(cursor + 1, currentBlock && cursor === history.length - 1 && nextBlockId ? history.length + 1 : history.length || 1);
  const progress = useMemo(() => ((cursor + 1) / visibleTotal) * 100, [cursor, visibleTotal]);
  const completionTitle =
    !form.completionTitle.trim() || isLegacyDefaultCompletionTitle(form.completionTitle)
      ? t("publicRunner.defaultCompletionTitle")
      : form.completionTitle.trim();
  const completionMessage =
    !form.completionMessage.trim() || isLegacyDefaultCompletionMessage(form.completionMessage)
      ? t("publicRunner.defaultCompletionMessage")
      : form.completionMessage.trim();
  const completionLinkLabel = form.completionLinkLabel?.trim() || null;
  const completionLinkUrl = form.completionLinkUrl?.trim() || null;

  function setAnswer(blockId: string, value: string | string[]) {
    setAnswers((current) => ({
      ...current,
      [blockId]: value,
    }));
  }

  const showToast = useCallback((message: string, variant: ToastData["variant"] = "success") => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, variant }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const validateStep = useCallback((answerSet: Record<string, string | string[]> = answers) => {
    if (!currentBlock || currentBlock.type === "TEXT") {
      return true;
    }

    const value = answerSet[currentBlock.id];

    if (currentBlock.type === "SHORT_TEXT" || currentBlock.type === "LONG_TEXT") {
      const textValue = typeof value === "string" ? value.trim() : "";

      if (!textValue) {
        if (!currentBlock.required) {
          return true;
        }

        showToast(t("publicRunner.answerRequired"), "error");
        return false;
      }

      const validationRegex = getTextValidationPattern(currentBlock.config as ShortTextBlockConfig | LongTextBlockConfig);

      if (validationRegex && !new RegExp(validationRegex).test(textValue)) {
        showToast(t("publicRunner.invalidTextFormat"), "error");
        return false;
      }

      return true;
    }

    if (currentBlock.type === "SINGLE_CHOICE") {
      if (typeof value === "string" && value.trim()) {
        return true;
      }

      if (currentBlock.required) {
        showToast(t("publicRunner.singleChoiceRequired"), "error");
        return false;
      }

      return true;
    }

    if (currentBlock.type === "MULTIPLE_CHOICE") {
      if (Array.isArray(value) && value.length > 0) {
        return true;
      }

      if (currentBlock.required) {
        showToast(t("publicRunner.multiChoiceRequired"), "error");
        return false;
      }

      return true;
    }

    if (currentBlock.type === "NUMBER") {
      const textValue = typeof value === "string" ? value.trim() : "";
      const config = currentBlock.config as NumberBlockConfig;

      if (!textValue) {
        if (!currentBlock.required) {
          return true;
        }

        showToast(t("publicRunner.answerRequired"), "error");
        return false;
      }

      const numericValue = parseNumericAnswer(textValue);

      if (numericValue === null) {
        showToast(t("publicRunner.invalidNumber"), "error");
        return false;
      }

      if (!config.allowFloat && !Number.isInteger(numericValue)) {
        showToast(t("publicRunner.wholeNumberRequired"), "error");
        return false;
      }

      if (config.min !== null && numericValue < config.min) {
        showToast(t("publicRunner.numberAtLeast", { min: config.min }), "error");
        return false;
      }

      if (config.max !== null && numericValue > config.max) {
        showToast(t("publicRunner.numberAtMost", { max: config.max }), "error");
        return false;
      }

      return true;
    }

    if (currentBlock.type === "LINK") {
      const textValue = typeof value === "string" ? value.trim() : "";

      if (!textValue) {
        if (!currentBlock.required) {
          return true;
        }

        showToast(t("publicRunner.answerRequired"), "error");
        return false;
      }

      if (!isValidLinkAnswer(textValue)) {
        showToast(t("publicRunner.invalidLink"), "error");
        return false;
      }

      return true;
    }

    if (currentBlock.type === "DATE") {
      const textValue = typeof value === "string" ? value.trim() : "";

      if (!textValue) {
        if (!currentBlock.required) {
          return true;
        }

        showToast(t("publicRunner.answerRequired"), "error");
        return false;
      }

      if (!isValidDateAnswer(textValue)) {
        showToast(t("publicRunner.invalidDate"), "error");
        return false;
      }

      return true;
    }

    if (currentBlock.type === "AGREEMENT") {
      const textValue = typeof value === "string" ? value.trim() : "";

      if (!textValue) {
        if (!currentBlock.required) {
          return true;
        }

        showToast(t("publicRunner.agreementRequired"), "error");
        return false;
      }

      if (currentBlock.required && textValue !== AGREEMENT_ANSWER_VALUES.AGREED) {
        showToast(t("publicRunner.agreementRequired"), "error");
        return false;
      }

      return textValue === AGREEMENT_ANSWER_VALUES.AGREED || textValue === AGREEMENT_ANSWER_VALUES.NOT_AGREED;
    }

    return true;
  }, [answers, currentBlock, showToast, t]);

  const handleContinue = useCallback(async (answerSet: Record<string, string | string[]> = answers) => {
    if (!validateStep(answerSet) || !currentBlock) {
      return;
    }

    const resolvedNextBlockId = resolveNextBlockId(form.blocks, currentBlock.id, answerSet);

    if (!resolvedNextBlockId) {
      try {
        setIsSubmitting(true);
        await submitResponse(form.slug, answerSet);
        setIsComplete(true);
      } catch (caughtError) {
        showToast(caughtError instanceof Error ? caughtError.message : t("publicRunner.submitError"), "error");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    setHistory((current) => [...current.slice(0, cursor + 1), resolvedNextBlockId]);
    setCursor((current) => current + 1);
  }, [answers, currentBlock, cursor, form.blocks, form.slug, showToast, t, validateStep]);

  const handleBack = useCallback(() => {
    setCursor((current) => Math.max(0, current - 1));
  }, []);

  function handleAdvanceKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    options?: { allowShiftEnter?: boolean },
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || isSubmitting) {
      return;
    }

    if (options?.allowShiftEnter && event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleContinue();
  }

  function handleChoiceEnter(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    nextAnswer: string | string[],
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || isSubmitting || !currentBlock) {
      return;
    }

    event.preventDefault();
    const nextAnswers = {
      ...answers,
      [currentBlock.id]: nextAnswer,
    };
    setAnswers(nextAnswers);
    void handleContinue(nextAnswers);
  }

  useEffect(() => {
    if (isComplete || isSubmitting || !currentBlock) {
      return;
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void handleContinue();
        return;
      }

      if (event.key === "Escape" && cursor > 0) {
        event.preventDefault();
        handleBack();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [currentBlock, cursor, handleBack, handleContinue, isComplete, isSubmitting]);

  if (isComplete) {
    return (
      <Card className="w-full max-w-3xl overflow-hidden">
        <div className="border-b border-[color:var(--line)] bg-[var(--accent-soft)]/55 px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">{t("publicRunner.responseReceived")}</p>
        </div>
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <h2 className="max-w-2xl font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">{completionTitle}</h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">{completionMessage}</p>
          {completionLinkLabel && completionLinkUrl ? (
            <div className="mt-8">
              <Link
                href={completionLinkUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "default", className: "w-fit !bg-[var(--ink)] !text-[var(--bg)]" })}
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
            <h1 className="font-display text-2xl leading-tight text-[var(--ink)] sm:text-3xl">{form.title}</h1>
          </div>

          <div className="w-full max-w-xs shrink-0">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-ink)]">
                {t("publicRunner.step", { current: cursor + 1, total: visibleTotal })}
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-strong)]">
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 130, damping: 20 }}
              />
            </div>
          </div>
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
            className="min-h-[280px]"
          >
            {currentBlock.type === "TEXT" ? (
              <div className="flex min-h-[240px] flex-col justify-center py-4">
                <h2 className="font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
                  {currentBlock.title || t("publicRunner.defaultTextTitle")}
                </h2>
                <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-[var(--ink)]/82">{(currentBlock.config as TextBlockConfig).body}</p>
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
                {currentBlock.description ? <p className="mt-3 text-base leading-7 text-[var(--muted)]">{currentBlock.description}</p> : null}

                <div className="mt-6 space-y-3">
                  {currentBlock.type === "SINGLE_CHOICE" ? (
                    <p className="text-sm font-medium text-[var(--muted)]">{t("publicRunner.chooseOne")}</p>
                  ) : null}

                  {currentBlock.type === "MULTIPLE_CHOICE" ? (
                    <p className="text-sm font-medium text-[var(--muted)]">{t("publicRunner.selectAll")}</p>
                  ) : null}
                  {currentBlock.type === "SHORT_TEXT" ? (
                    <Input
                      className="h-12 text-base placeholder:text-[var(--muted)]/65"
                      placeholder={(currentBlock.config as ShortTextBlockConfig).placeholder}
                      value={typeof answers[currentBlock.id] === "string" ? answers[currentBlock.id] : ""}
                      onChange={(event) => setAnswer(currentBlock.id, event.target.value)}
                      onKeyDown={handleAdvanceKeyDown}
                    />
                  ) : null}

                  {currentBlock.type === "LONG_TEXT" ? (
                    <Textarea
                      className="min-h-[140px] text-base placeholder:text-[var(--muted)]/65"
                      placeholder={(currentBlock.config as LongTextBlockConfig).placeholder}
                      value={typeof answers[currentBlock.id] === "string" ? answers[currentBlock.id] : ""}
                      onChange={(event) => setAnswer(currentBlock.id, event.target.value)}
                      onKeyDown={(event) => handleAdvanceKeyDown(event, { allowShiftEnter: true })}
                    />
                  ) : null}

                  {currentBlock.type === "NUMBER" ? (
                    <Input
                      type="number"
                      step={(currentBlock.config as NumberBlockConfig).allowFloat ? "any" : "1"}
                      className="h-12 text-base placeholder:text-[var(--muted)]/65"
                      placeholder={(currentBlock.config as NumberBlockConfig).placeholder}
                      value={typeof answers[currentBlock.id] === "string" ? answers[currentBlock.id] : ""}
                      onChange={(event) => setAnswer(currentBlock.id, event.target.value)}
                      onKeyDown={handleAdvanceKeyDown}
                    />
                  ) : null}

                  {currentBlock.type === "LINK" ? (
                    <Input
                      type="url"
                      className="h-12 text-base placeholder:text-[var(--muted)]/65"
                      placeholder={(currentBlock.config as LinkBlockConfig).placeholder}
                      value={typeof answers[currentBlock.id] === "string" ? answers[currentBlock.id] : ""}
                      onChange={(event) => setAnswer(currentBlock.id, event.target.value)}
                      onKeyDown={handleAdvanceKeyDown}
                    />
                  ) : null}

                  {currentBlock.type === "DATE"
                    ? (() => {
                        const currentValue = answers[currentBlock.id];

                        return (
                          <DatePickerInput
                            className="text-base"
                            value={typeof currentValue === "string" ? currentValue : ""}
                            onChange={(value) => setAnswer(currentBlock.id, value)}
                            onKeyDown={handleAdvanceKeyDown}
                            openCalendarLabel={t("publicRunner.openCalendar")}
                          />
                        );
                      })()
                    : null}

                  {currentBlock.type === "SINGLE_CHOICE" ? (
                    <div className="grid gap-3">
                      {(currentBlock.config as ChoiceBlockConfig).options.map((option) => {
                        const selected = answers[currentBlock.id] === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            className={cn(
                              "flex items-center justify-between rounded-[16px] border px-4 py-3 text-left transition",
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[var(--shadow-accent)]"
                                : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                            )}
                            onClick={() => setAnswer(currentBlock.id, option)}
                            onKeyDown={(event) => handleChoiceEnter(event, option)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex size-5 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--surface)]">
                                {selected ? <Check className="size-3.5 text-[var(--accent)]" /> : <Circle className="size-3.5 text-[var(--muted)]/55" />}
                              </span>
                              <span>{option}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {currentBlock.type === "MULTIPLE_CHOICE" ? (
                    <div className="grid gap-3">
                      {(currentBlock.config as ChoiceBlockConfig).options.map((option) => {
                        const rawValues = answers[currentBlock.id];
                        const currentValues: string[] = Array.isArray(rawValues) ? rawValues : [];
                        const selected = currentValues.includes(option);

                        return (
                          <button
                            key={option}
                            type="button"
                            className={cn(
                              "flex items-center justify-between rounded-[16px] border px-4 py-3 text-left transition",
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[var(--shadow-accent)]"
                                : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                            )}
                            onClick={() => {
                              const nextValues = selected
                                ? currentValues.filter((value) => value !== option)
                                : [...currentValues, option];
                              setAnswer(currentBlock.id, nextValues);
                            }}
                            onKeyDown={(event) =>
                              handleChoiceEnter(
                                event,
                                selected
                                  ? currentValues.filter((value) => value !== option)
                                  : [...currentValues, option],
                              )
                            }
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex size-5 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[var(--surface)]">
                                {selected ? <Check className="size-3.5 text-[var(--accent)]" /> : <Square className="size-3.5 text-[var(--muted)]/55" />}
                              </span>
                              <span>{option}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {currentBlock.type === "AGREEMENT" ? (
                    <div className="grid gap-3">
                      {(() => {
                        const selected = answers[currentBlock.id] === AGREEMENT_ANSWER_VALUES.AGREED;
                        const label = "label" in currentBlock.config ? currentBlock.config.label : t("publicRunner.agree");
                        const nextValue = selected ? "" : AGREEMENT_ANSWER_VALUES.AGREED;

                        return (
                          <button
                            type="button"
                            className={cn(
                              "flex items-center justify-between rounded-[16px] border px-4 py-3 text-left transition",
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[var(--shadow-accent)]"
                                : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-[var(--surface)]",
                            )}
                            onClick={() => setAnswer(currentBlock.id, nextValue)}
                            onKeyDown={(event) => handleChoiceEnter(event, nextValue)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex size-5 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[var(--surface)]">
                                {selected ? <Check className="size-3.5 text-[var(--accent)]" /> : <Square className="size-3.5 text-[var(--muted)]/55" />}
                              </span>
                              <span>{label}</span>
                            </div>
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
          <Button variant="secondary" onClick={handleBack} disabled={cursor === 0 || isSubmitting}>
            {t("publicRunner.back")}
            <span className="ml-1 inline-flex h-5 items-center rounded-md border border-current/20 bg-black/10 px-1.5 text-[10px] font-medium opacity-90 dark:bg-white/10">
              Esc
            </span>
          </Button>
          <Button onClick={() => void handleContinue()} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {!nextBlockId ? t("publicRunner.submit") : t("publicRunner.continue")}
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
