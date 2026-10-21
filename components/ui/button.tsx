import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-[var(--bg)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] px-3.5 text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] focus-visible:ring-[var(--accent)]",
        secondary:
          "bg-[var(--surface-strong)] px-3.5 text-[var(--ink)] ring-1 ring-[color:var(--line)] hover:bg-[var(--accent-soft)] hover:ring-[color:var(--line-strong)] focus-visible:ring-[var(--accent)]",
        ghost:
          "px-3 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)] focus-visible:ring-[var(--ink)]",
        danger:
          "bg-[var(--surface-strong)] px-3.5 text-[var(--muted)] ring-1 ring-[color:var(--line)] hover:bg-[var(--danger-hover)] hover:text-[var(--danger-contrast)] hover:ring-[var(--danger-hover)] focus-visible:ring-[var(--danger-hover)]",
      },
      size: {
        default: "h-9",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5 text-base",
        icon: "h-9 w-9 rounded-md px-0",
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
