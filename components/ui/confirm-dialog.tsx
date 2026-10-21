"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: "default" | "danger";
  pending?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  actions?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "danger",
  pending = false,
  onClose,
  onConfirm,
  actions,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, pending]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.28)] px-6 py-8"
      onClick={() => {
        if (!pending) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-[color:var(--line)] bg-[var(--bg-strong)] p-6 shadow-[var(--shadow-elevated)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--ink)]">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
        {actions ?? (
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={pending}
            >
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
