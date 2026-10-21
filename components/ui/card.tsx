import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)]",
        className,
      )}
      {...props}
    />
  );
}
