import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-[var(--bg)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] px-5 py-3 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] focus-visible:ring-[var(--accent)]",
        secondary:
          "bg-[var(--surface-strong)] px-5 py-3 text-[var(--ink)] ring-1 ring-[color:var(--line)] hover:bg-[var(--surface)] focus-visible:ring-[var(--ink)]",
        ghost:
          "px-3 py-2 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)] focus-visible:ring-[var(--ink)]",
        danger:
          "bg-[var(--surface-strong)] px-5 py-3 text-[var(--muted)] ring-1 ring-[color:var(--line)] hover:bg-[var(--danger-hover)] hover:text-[var(--danger-contrast)] hover:ring-[var(--danger-hover)] focus-visible:ring-[var(--danger-hover)]",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 rounded-xl px-0 py-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
