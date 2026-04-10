"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, LoaderCircle } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { ToastViewport, type ToastData } from "@/components/ui/toast";

type ResponseExportFormat = "csv" | "xlsx";

function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) {
    return fallback;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? fallback;
}

export function ResponseExportActions({ formId }: { formId: string }) {
  const { t } = useI18n();
  const [busyFormat, setBusyFormat] = useState<ResponseExportFormat | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  function showToast(message: string, variant: ToastData["variant"] = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, variant }]);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (!isMenuOpen) {
      return;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  async function exportResponses(format: ResponseExportFormat) {
    try {
      setBusyFormat(format);

      const response = await fetch(`/api/forms/${formId}/export?format=${format}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? t("responseExport.error"));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = getFilenameFromDisposition(
        response.headers.get("Content-Disposition"),
        `responses.${format}`,
      );
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setIsMenuOpen(false);
      showToast(t("responseExport.downloaded", { format: format.toUpperCase() }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("responseExport.error"), "error");
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <Button
          variant="secondary"
          disabled={busyFormat !== null}
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          {busyFormat ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
          {t("responseExport.export")}
          <ChevronDown className="size-4 text-[var(--muted)]" />
        </Button>
        {isMenuOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 min-w-[180px] rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] p-2 shadow-[var(--shadow-card)]">
            <div className="grid gap-1">
              <button
                type="button"
                className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)] disabled:opacity-60"
                onClick={() => exportResponses("csv")}
                disabled={busyFormat !== null}
              >
                {busyFormat === "csv" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                CSV
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)] disabled:opacity-60"
                onClick={() => exportResponses("xlsx")}
                disabled={busyFormat !== null}
              >
                {busyFormat === "xlsx" ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                XLSX
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
