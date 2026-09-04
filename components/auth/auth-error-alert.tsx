"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export function AuthErrorAlert({ message }: { message: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);

    if (!url.searchParams.has("authError")) {
      return;
    }

    url.searchParams.delete("authError");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3.5 py-3 text-sm leading-5 text-[var(--danger-ink)]"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
