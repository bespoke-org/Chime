"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentBlock = form.blocks[step];
  const progress = useMemo(() => ((step + 1) / form.blocks.length) * 100, [form.blocks.length, step]);

  function setAnswer(blockId: string, value: string | string[]) {
    setAnswers((current) => ({
      ...current,
      [blockId]: value,
    }));
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

      setError("Please answer before continuing.");
      return false;
    }

    if (currentBlock.type === "SINGLE_CHOICE") {
      if (typeof value === "string" && value.trim()) {
        return true;
      }

      setError("Choose one option before continuing.");
      return false;
    }

    if (currentBlock.type === "MULTIPLE_CHOICE") {
      if (Array.isArray(value) && value.length > 0) {
        return true;
      }

      setError("Choose at least one option before continuing.");
      return false;
    }

    return true;
  }

  async function handleContinue() {
    setError(null);

    if (!validateStep()) {
      return;
    }

    if (step === form.blocks.length - 1) {
      try {
        setIsSubmitting(true);
        await submitResponse(form.slug, answers);
        setIsComplete(true);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not submit response.");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    setStep((current) => current + 1);
  }

  function handleBack() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  if (isComplete) {
    return (
      <Card className="w-full max-w-3xl overflow-hidden bg-[#16120f] p-10 text-white shadow-[0_36px_120px_rgba(22,18,15,0.32)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#b9dfb9]">Response received</p>
        <h2 className="mt-6 font-display text-5xl">Thanks for taking the time.</h2>
        <p className="mt-4 max-w-2xl text-base leading-8 text-white/72">
          Your response was submitted anonymously. The creator can review your answers, but they are not linked to a
          login or account.
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl overflow-hidden bg-[#16120f] p-4 text-white shadow-[0_36px_120px_rgba(22,18,15,0.32)] sm:p-6 lg:p-8">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#b9dfb9]">{form.title}</p>
            {form.description ? <p className="mt-2 max-w-xl text-sm leading-7 text-white/62">{form.description}</p> : null}
          </div>
          <div className="sm:min-w-[180px]">
            <div className="h-2 rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-[#9fd7a4]"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 130, damping: 20 }}
              />
            </div>
            <p className="mt-2 text-right text-xs uppercase tracking-[0.24em] text-white/45">
              Step {step + 1} of {form.blocks.length}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentBlock.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="min-h-[360px]"
          >
            {currentBlock.type === "TEXT" ? (
              <div className="flex min-h-[320px] flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/38">Context</p>
                <h2 className="mt-5 font-display text-4xl leading-tight sm:text-6xl">{currentBlock.title || "Take a breath before the next step."}</h2>
                {currentBlock.description ? <p className="mt-5 max-w-2xl text-base leading-8 text-white/72">{currentBlock.description}</p> : null}
                <p className="mt-6 max-w-2xl text-lg leading-9 text-white/78">{(currentBlock.config as { body: string }).body}</p>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/38">Question</p>
                <h2 className="mt-5 font-display text-4xl leading-tight sm:text-6xl">{currentBlock.title}</h2>
                {currentBlock.description ? <p className="mt-5 max-w-2xl text-base leading-8 text-white/72">{currentBlock.description}</p> : null}

                <div className="mt-10 space-y-4">
                  {currentBlock.type === "SHORT_TEXT" ? (
                    <Input
                      className="h-14 rounded-[18px] border-white/10 bg-white/6 text-lg text-white placeholder:text-white/28"
                      placeholder={(currentBlock.config as { placeholder: string }).placeholder}
                      value={typeof answers[currentBlock.id] === "string" ? answers[currentBlock.id] : ""}
                      onChange={(event) => setAnswer(currentBlock.id, event.target.value)}
                    />
                  ) : null}

                  {currentBlock.type === "LONG_TEXT" ? (
                    <Textarea
                      className="min-h-[180px] rounded-[20px] border-white/10 bg-white/6 text-lg text-white placeholder:text-white/28"
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
                              "flex items-center justify-between rounded-[16px] border px-5 py-4 text-left transition",
                              selected
                                ? "border-[#9fd7a4] bg-[#9fd7a4]/16 text-white"
                                : "border-white/10 bg-white/4 text-white/78 hover:bg-white/8",
                            )}
                            onClick={() => setAnswer(currentBlock.id, option)}
                          >
                            <span>{option}</span>
                            {selected ? <Check className="size-4" /> : null}
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
                              "flex items-center justify-between rounded-[16px] border px-5 py-4 text-left transition",
                              selected
                                ? "border-[#9fd7a4] bg-[#9fd7a4]/16 text-white"
                                : "border-white/10 bg-white/4 text-white/78 hover:bg-white/8",
                            )}
                            onClick={() => {
                              const nextValues = selected
                                ? currentValues.filter((value) => value !== option)
                                : [...currentValues, option];
                              setAnswer(currentBlock.id, nextValues);
                            }}
                          >
                            <span>{option}</span>
                            {selected ? <Check className="size-4" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                {currentBlock.required ? (
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#b9dfb9]">Required</p>
                ) : null}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error ? <p className="mt-4 text-sm text-[#f8b4b4]">{error}</p> : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="secondary" className="border border-white/10 bg-white/5 text-white hover:bg-white/12" onClick={handleBack} disabled={step === 0 || isSubmitting}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button className="bg-[#9fd7a4] text-[#122012] hover:bg-[#b8e4bb]" onClick={handleContinue} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {step === form.blocks.length - 1 ? "Submit response" : "Continue"}
            {!isSubmitting ? <ArrowRight className="size-4" /> : null}
          </Button>
        </div>
      </div>
    </Card>
  );
}
