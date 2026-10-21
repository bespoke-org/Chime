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
        "flex h-10 w-full rounded-md border border-[color:var(--line)] bg-[var(--surface-strong)] px-3.5 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[color:var(--line-strong)] focus:ring-2 focus:ring-[var(--accent-soft)]",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
