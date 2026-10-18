"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export type ToastData = {
  id: string;
  message: string;
  variant: "success" | "error";
  duration?: number;
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(
      () => {
        onDismiss(toast.id);
      },
      toast.duration ?? (toast.variant === "error" ? 5000 : 2600),
    );

    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.duration, toast.id, toast.variant]);

  const { t } = useI18n();
  const Icon = toast.variant === "error" ? AlertCircle : CheckCircle2;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, y: 8, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--bg-strong)] px-4 py-3 shadow-[var(--shadow-toast)]",
        toast.variant === "error"
          ? "border-[color:var(--danger-line)] text-[var(--danger-ink)]"
          : "border-[color:var(--accent)] text-[var(--accent-ink)]",
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm leading-6">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={cn(
          "rounded-full p-1 opacity-60 transition hover:opacity-100",
          toast.variant === "error"
            ? "hover:bg-[var(--danger-soft)]"
            : "hover:bg-[var(--accent-soft)]",
        )}
        aria-label={t("ui.dismissNotification")}
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
