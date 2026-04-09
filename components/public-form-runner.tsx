"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Circle, LoaderCircle, Square } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToastViewport, type ToastData } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BlockType = "TEXT" | "SHORT_TEXT" | "LONG_TEXT" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE";

type PublicBlock = {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  required: boolean;
  position: number;
  config:
    | { body: string }
    | { placeholder: string }
    | { options: string[] };
};

type PublicForm = {
  id: string;
  title: string;
  description: string;
  completionTitle: string;
  completionMessage: string;
  completionLinkLabel: string | null;
  completionLinkUrl: string | null;
  slug: string;
  blocks: PublicBlock[];
};

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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentBlock = form.blocks[step];
  const progress = useMemo(() => ((step + 1) / form.blocks.length) * 100, [form.blocks.length, step]);
  const completionTitle = form.completionTitle.trim() || "Thanks for taking the time.";
  const completionMessage =
    form.completionMessage.trim() ||
    "Your response was submitted anonymously. The creator can review your answers, but they are not linked to a login or account.";
  const completionLinkLabel = form.completionLinkLabel?.trim() || null;
  const completionLinkUrl = form.completionLinkUrl?.trim() || null;

  function setAnswer(blockId: string, value: string | string[]) {
    setAnswers((current) => ({
      ...current,
      [blockId]: value,
    }));
  }

  function showToast(message: string, variant: ToastData["variant"] = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, variant }]);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function validateStep() {
    if (!currentBlock || currentBlock.type === "TEXT") {
      return true;
    }

    const value = answers[currentBlock.id];

    if (!currentBlock.required) {
      return true;
    }

    if (currentBlock.type === "SHORT_TEXT" || currentBlock.type === "LONG_TEXT") {
      if (typeof value === "string" && value.trim()) {
        return true;
      }

      showToast("Please answer before continuing.", "error");
      return false;
    }

    if (currentBlock.type === "SINGLE_CHOICE") {
      if (typeof value === "string" && value.trim()) {
        return true;
      }

      showToast("Choose one option before continuing.", "error");
      return false;
    }

    if (currentBlock.type === "MULTIPLE_CHOICE") {
      if (Array.isArray(value) && value.length > 0) {
        return true;
      }

      showToast("Choose at least one option before continuing.", "error");
      return false;
    }

    return true;
  }

  async function handleContinue() {
    if (!validateStep()) {
      return;
    }

    if (step === form.blocks.length - 1) {
      try {
        setIsSubmitting(true);
        await submitResponse(form.slug, answers);
        setIsComplete(true);
      } catch (caughtError) {
        showToast(caughtError instanceof Error ? caughtError.message : "Could not submit response.", "error");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    setStep((current) => current + 1);
  }

  function handleBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  if (isComplete) {
    return (
      <Card className="w-full max-w-3xl overflow-hidden">
        <div className="border-b border-black/8 bg-[var(--accent-soft)]/55 px-6 py-6 sm:px-8">
          <div className="flex items-center gap-4">
            <Image src="/sproute.png" alt="Lively Forms" width={44} height={44} priority className="size-11" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Response received</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Lively Forms</p>
            </div>
          </div>
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
                className={buttonVariants({ className: "w-fit" })}
              >
                {completionLinkLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <Card className="w-full max-w-5xl overflow-hidden">
      <div className="border-b border-black/8 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <Image src="/sproute.png" alt="Lively Forms" width={44} height={44} priority className="size-11 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Lively Forms</p>
                <h1 className="mt-2 font-display text-3xl leading-tight text-[var(--ink)] sm:text-4xl">{form.title}</h1>
              </div>
            </div>
            {form.description ? <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">{form.description}</p> : null}
          </div>

          <div className="w-full max-w-sm shrink-0">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f5d35]">
                Step {step + 1} of {form.blocks.length}
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

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBlock.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="min-h-[360px]"
          >
            {currentBlock.type === "TEXT" ? (
              <div className="flex min-h-[320px] flex-col justify-center rounded-[18px] bg-[var(--bg-strong)]/75 px-6 py-8 sm:px-8">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Context</p>
                <h2 className="mt-5 max-w-3xl font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
                  {currentBlock.title || "Take a breath before the next step."}
                </h2>
                {currentBlock.description ? <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">{currentBlock.description}</p> : null}
                <p className="mt-6 max-w-3xl text-lg leading-9 text-[var(--ink)]/82">{(currentBlock.config as { body: string }).body}</p>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col justify-center">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Question</p>
                  {currentBlock.required ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f5d35]">
                      Required
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-5 max-w-3xl font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
                  {currentBlock.title}
                </h2>
                {currentBlock.description ? <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">{currentBlock.description}</p> : null}

                <div className="mt-10 space-y-4">
                  {currentBlock.type === "SINGLE_CHOICE" ? (
                    <p className="text-sm font-medium text-[var(--muted)]">Choose one option.</p>
                  ) : null}

                  {currentBlock.type === "MULTIPLE_CHOICE" ? (
                    <p className="text-sm font-medium text-[var(--muted)]">Select all that apply.</p>
                  ) : null}
                  {currentBlock.type === "SHORT_TEXT" ? (
                    <Input
                      className="h-14 border-black/10 bg-[var(--surface-strong)] text-base text-[var(--ink)] placeholder:text-[var(--muted)]/65"
                      placeholder={(currentBlock.config as { placeholder: string }).placeholder}
                      value={typeof answers[currentBlock.id] === "string" ? answers[currentBlock.id] : ""}
                      onChange={(event) => setAnswer(currentBlock.id, event.target.value)}
                    />
                  ) : null}

                  {currentBlock.type === "LONG_TEXT" ? (
                    <Textarea
                      className="min-h-[180px] border-black/10 bg-[var(--surface-strong)] text-base text-[var(--ink)] placeholder:text-[var(--muted)]/65"
                      placeholder={(currentBlock.config as { placeholder: string }).placeholder}
                      value={typeof answers[currentBlock.id] === "string" ? answers[currentBlock.id] : ""}
                      onChange={(event) => setAnswer(currentBlock.id, event.target.value)}
                    />
                  ) : null}

                  {currentBlock.type === "SINGLE_CHOICE" ? (
                    <div className="grid gap-3">
                      {(currentBlock.config as { options: string[] }).options.map((option) => {
                        const selected = answers[currentBlock.id] === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            className={cn(
                              "flex items-center justify-between rounded-[18px] border px-5 py-4 text-left transition",
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[0_12px_28px_rgba(79,122,88,0.08)]"
                                : "border-black/8 bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-white",
                            )}
                            onClick={() => setAnswer(currentBlock.id, option)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex size-5 items-center justify-center rounded-full border border-black/12 bg-white/70">
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
                      {(currentBlock.config as { options: string[] }).options.map((option) => {
                        const rawValues = answers[currentBlock.id];
                        const currentValues: string[] = Array.isArray(rawValues) ? rawValues : [];
                        const selected = currentValues.includes(option);

                        return (
                          <button
                            key={option}
                            type="button"
                            className={cn(
                              "flex items-center justify-between rounded-[18px] border px-5 py-4 text-left transition",
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] shadow-[0_12px_28px_rgba(79,122,88,0.08)]"
                                : "border-black/8 bg-[var(--surface-strong)] text-[var(--ink)] hover:bg-white",
                            )}
                            onClick={() => {
                              const nextValues = selected
                                ? currentValues.filter((value) => value !== option)
                                : [...currentValues, option];
                              setAnswer(currentBlock.id, nextValues);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex size-5 items-center justify-center rounded-[6px] border border-black/12 bg-white/70">
                                {selected ? <Check className="size-3.5 text-[var(--accent)]" /> : <Square className="size-3.5 text-[var(--muted)]/55" />}
                              </span>
                              <span>{option}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-black/8 pt-6">
          <Button variant="secondary" onClick={handleBack} disabled={step === 0 || isSubmitting}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button onClick={handleContinue} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {step === form.blocks.length - 1 ? "Submit response" : "Continue"}
            {!isSubmitting ? <ArrowRight className="size-4" /> : null}
          </Button>
        </div>
      </div>
    </Card>
    </>
  );
}
