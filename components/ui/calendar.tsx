"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayPicker,
  type DayButton,
  getDefaultClassNames,
} from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("bg-transparent p-1", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-9 rounded-xl border border-[color:var(--line)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-9 rounded-xl border border-[color:var(--line)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-9 w-full items-center justify-center px-10",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-9 w-full items-center justify-center gap-2 text-sm font-semibold text-[var(--ink)]",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-xl border border-[color:var(--line)] bg-[var(--surface)]",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "text-sm font-semibold text-[var(--ink)]",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex gap-1", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-xl py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full gap-1", defaultClassNames.week),
        day: cn("relative h-10 w-10 p-0 text-center", defaultClassNames.day),
        today: cn(
          "rounded-xl ring-1 ring-[color:var(--line-strong)]",
          defaultClassNames.today,
        ),
        outside: cn("text-[var(--muted)]/45", defaultClassNames.outside),
        disabled: cn(
          "pointer-events-none opacity-40",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className: iconClassName, orientation, ...iconProps }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className={cn("size-4", iconClassName)}
                {...iconProps}
              />
            );
          }

          if (orientation === "right") {
            return (
              <ChevronRight
                className={cn("size-4", iconClassName)}
                {...iconProps}
              />
            );
          }

          return (
            <ChevronDown
              className={cn("size-4", iconClassName)}
              {...iconProps}
            />
          );
        },
        DayButton: CalendarDayButton,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus();
    }
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      className={cn(
        "size-10 rounded-xl text-sm font-medium shadow-none focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
        modifiers.selected
          ? "bg-[var(--accent)] text-white hover:bg-[var(--accent)] hover:text-white"
          : "bg-transparent text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
        modifiers.today && !modifiers.selected
          ? "border border-[color:var(--line-strong)]"
          : "border border-transparent",
        modifiers.outside
          ? "text-[var(--muted)]/45 hover:text-[var(--muted)]"
          : null,
        modifiers.disabled ? "pointer-events-none opacity-40" : null,
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { CalendarDayButton };
