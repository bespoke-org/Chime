import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border border-[color:var(--line)] bg-[var(--bg-strong)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}
