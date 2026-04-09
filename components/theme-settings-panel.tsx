"use client";

import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useThemePreference } from "@/components/theme-provider";
import { cn, sentenceCase } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";

const options: Array<{
  value: ThemePreference;
  title: string;
  description: string;
  icon: typeof SunMedium;
}> = [
  {
    value: "light",
    title: "Light",
    description: "Always use the light theme.",
    icon: SunMedium,
  },
  {
    value: "dark",
    title: "Dark",
    description: "Always use the dark theme.",
    icon: MoonStar,
  },
  {
    value: "system",
    title: "System",
    description: "Follow your device theme automatically.",
    icon: LaptopMinimal,
  },
];

export function ThemeSettingsPanel() {
  const { preference, resolvedTheme, setPreference } = useThemePreference();

  return (
    <Card className="p-6 lg:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Appearance</p>
        <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">Theme settings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Choose how Lively Forms looks across creator pages, public forms, and the home page.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = preference === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreference(option.value)}
              className={cn(
                "rounded-[18px] border p-5 text-left transition",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_16px_40px_rgba(79,122,88,0.10)]"
                  : "border-[color:var(--line)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]",
              )}
              aria-pressed={selected}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--bg-strong)] text-[var(--ink)]">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{option.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-5 py-4">
        <p className="text-sm text-[var(--muted)]">
          Selected mode: <span className="font-medium text-[var(--ink)]">{sentenceCase(preference)}</span>
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Active theme right now: <span className="font-medium text-[var(--ink)]">{sentenceCase(resolvedTheme)}</span>
        </p>
      </div>
    </Card>
  );
}
