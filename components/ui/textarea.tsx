import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[120px] w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/5",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
