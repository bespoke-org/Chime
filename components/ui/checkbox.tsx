import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer size-5 cursor-pointer appearance-none rounded-md border border-[color:var(--line)] bg-[var(--surface-strong)] outline-none transition-all duration-200 hover:border-[color:var(--line-strong)] hover:bg-[var(--surface)] checked:border-[var(--accent)] checked:bg-[var(--accent-soft)] checked:shadow-[var(--shadow-accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <Check className="pointer-events-none absolute size-3.5 text-[var(--accent)] opacity-0 transition-opacity duration-200 peer-checked:opacity-100" />
    </span>
  );
});
Checkbox.displayName = "Checkbox";
