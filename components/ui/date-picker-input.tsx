"use client";

import { CalendarIcon } from "lucide-react";
import {
  forwardRef,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
} from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isValidDateAnswer } from "@/lib/blocks";
import { cn } from "@/lib/utils";

type DatePickerInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  openCalendarLabel: string;
};

function parseDateValue(value: string) {
  if (!isValidDateAnswer(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const DatePickerInput = forwardRef<
  HTMLInputElement,
  DatePickerInputProps
>(function DatePickerInput(
  { className, onChange, onKeyDown, openCalendarLabel, value, ...props },
  ref,
) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDate ?? new Date(),
  );

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="YYYY-MM-DD"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-12 pr-14 text-base tabular-nums placeholder:text-[var(--muted)]/65",
          className,
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={openCalendarLabel}
            className="absolute top-1.5 right-1.5 size-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          >
            <CalendarIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-2">
          <Calendar
            mode="single"
            month={selectedDate ?? visibleMonth}
            selected={selectedDate}
            onMonthChange={setVisibleMonth}
            onSelect={(date) => {
              if (!date) {
                return;
              }

              setVisibleMonth(date);
              onChange(formatDateValue(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
});
