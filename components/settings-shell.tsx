"use client";

import { Building2, Palette, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { OrganizationSettingsPanel } from "@/components/organization-settings-panel";
import { ProfileSettingsPanel } from "@/components/profile-settings-panel";
import { ThemeSettingsPanel } from "@/components/theme-settings-panel";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type {
  OrganizationSettingsSummary,
  ProfileSettingsUserSummary,
} from "@/lib/form-types";

type SettingsSection = "profile" | "organizations" | "appearance";

const sectionMeta: Record<
  SettingsSection,
  { key: string; icon: typeof Building2 }
> = {
  profile: {
    key: "profile",
    icon: UserRound,
  },
  organizations: {
    key: "organizations",
    icon: Building2,
  },
  appearance: {
    key: "appearance",
    icon: Palette,
  },
};

export function SettingsShell({
  organizations,
  profileUser,
  initialOrganizationId,
  initialSection,
}: {
  organizations: OrganizationSettingsSummary[];
  profileUser: ProfileSettingsUserSummary;
  initialOrganizationId: string | null;
  initialSection: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [selection, setSelection] = useState<SettingsSection>(
    initialSection === "organizations" || initialSection === "appearance"
      ? initialSection
      : "profile",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.shell.title")}
        description={t("settings.shell.description")}
        descriptionClassName="max-w-2xl"
      />

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-2 border-b border-[color:var(--line)] pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
          {(Object.keys(sectionMeta) as SettingsSection[]).map((section) => {
            const meta = sectionMeta[section];
            const Icon = meta.icon;
            const selected = selection === section;

            return (
              <button
                key={section}
                type="button"
                onClick={() => {
                  setSelection(section);
                  const nextParams = new URLSearchParams(
                    searchParams.toString(),
                  );
                  nextParams.set("section", section);
                  router.replace(`${pathname}?${nextParams.toString()}`, {
                    scroll: false,
                  });
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition",
                  selected
                    ? "bg-[var(--surface-strong)] text-[var(--ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
                )}
              >
                <div
                  className={cn(
                    "rounded-full p-1.5",
                    selected
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : "bg-[var(--bg-strong)] text-[var(--muted)]",
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t(`settings.sections.${meta.key}.title`)}
                  </p>
                  <p className="mt-1 truncate text-xs opacity-80">
                    {t(`settings.sections.${meta.key}.description`)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0">
          {selection === "profile" ? (
            <ProfileSettingsPanel
              user={profileUser}
              initialOrganizationId={initialOrganizationId}
            />
          ) : selection === "organizations" ? (
            <OrganizationSettingsPanel
              organizations={organizations}
              initialOrganizationId={initialOrganizationId}
            />
          ) : (
            <ThemeSettingsPanel />
          )}
        </div>
      </div>
    </div>
  );
}
