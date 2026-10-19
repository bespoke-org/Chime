"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useThemePreference } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

// The icon follows data-theme on <html>, which is set before hydration, so
// the server and client render the same markup.
export function ThemeToggle() {
  const { resolvedTheme, setPreference } = useThemePreference();
  const { t } = useI18n();

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={t("settings.appearance.toggle")}
      title={t("settings.appearance.toggle")}
      onClick={() => setPreference(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonStar className="size-5 [[data-theme=dark]_&]:hidden" />
      <SunMedium className="hidden size-5 [[data-theme=dark]_&]:block" />
    </Button>
  );
}
