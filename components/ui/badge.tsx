import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border border-black/8 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}
