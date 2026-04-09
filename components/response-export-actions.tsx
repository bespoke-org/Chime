"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";

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
  const [busyFormat, setBusyFormat] = useState<ResponseExportFormat | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  function showToast(message: string, variant: ToastData["variant"] = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, variant }]);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  async function exportResponses(format: ResponseExportFormat) {
    try {
      setBusyFormat(format);

      const response = await fetch(`/api/forms/${formId}/export?format=${format}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not export responses.");
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

      showToast(`Downloaded ${format.toUpperCase()} export.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not export responses.", "error");
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busyFormat !== null} onClick={() => exportResponses("csv")}>
          {busyFormat === "csv" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export CSV
        </Button>
        <Button variant="secondary" disabled={busyFormat !== null} onClick={() => exportResponses("xlsx")}>
          {busyFormat === "xlsx" ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
          Export XLSX
        </Button>
      </div>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
