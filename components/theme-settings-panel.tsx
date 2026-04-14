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
        description={t("settings.appearance.description")}
        descriptionClassName="max-w-2xl"
        className="border-b-0 pb-0"
      />

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
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-accent)]"
                  : "border-[color:var(--line)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]",
              )}
              aria-pressed={selected}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center text-[var(--ink)]">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-[var(--ink)]">
                    {t(`settings.appearance.options.${option.value}.title`)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {t(
                      `settings.appearance.options.${option.value}.description`,
                    )}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
