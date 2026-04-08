import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-[var(--bg)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ink)] px-5 py-3 text-[var(--bg)] shadow-[0_16px_40px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.24)] focus-visible:ring-[var(--ink)]",
        secondary:
          "bg-white/70 px-5 py-3 text-[var(--ink)] ring-1 ring-black/10 hover:bg-white focus-visible:ring-[var(--ink)]",
        ghost:
          "px-3 py-2 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)] focus-visible:ring-[var(--ink)]",
        danger:
          "bg-[#f87171] px-5 py-3 text-white shadow-[0_12px_28px_rgba(248,113,113,0.28)] hover:bg-[#ef4444] focus-visible:ring-[#ef4444]",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} type={type} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
