import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
