"use client";

import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useThemePreference } from "@/components/theme-provider";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";

const options: Array<{
  value: ThemePreference;
  icon: typeof SunMedium;
}> = [
  {
    value: "light",
    icon: SunMedium,
  },
  {
    value: "dark",
    icon: MoonStar,
  },
  {
    value: "system",
    icon: LaptopMinimal,
  },
];

export function ThemeSettingsPanel() {
  const { preference, setPreference } = useThemePreference();
  const { t } = useI18n();

  return (
    <div>
      <PageHeader
        title={t("settings.appearance.title")}
        className="border-b-0 pb-0"
      />

      <div
        role="group"
        aria-label={t("settings.appearance.title")}
        className="mt-8 inline-flex rounded-md border border-[color:var(--line)] p-1"
      >
        {options.map((option) => {
          const Icon = option.icon;
          const selected = preference === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreference(option.value)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm transition",
                selected
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-ink)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
              aria-pressed={selected}
            >
              <Icon className="size-4" />
              {t(`settings.appearance.options.${option.value}.title`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
