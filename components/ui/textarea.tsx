import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[color:var(--line-strong)] focus:ring-2 focus:ring-[var(--accent-soft)]",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
