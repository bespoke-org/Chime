import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition focus:border-[color:var(--line-strong)] focus:ring-2 focus:ring-[var(--accent-soft)]",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
