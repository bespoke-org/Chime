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
  digestTimezone,
}: {
  organizations: OrganizationSettingsSummary[];
  profileUser: ProfileSettingsUserSummary;
  initialOrganizationId: string | null;
  initialSection: string;
  digestTimezone: string;
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
      <PageHeader title={t("settings.shell.title")} />

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-1 border-b border-[color:var(--line)] pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
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
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                  selected
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
                )}
                aria-current={selected ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {t(`settings.sections.${meta.key}.title`)}
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
              digestTimezone={digestTimezone}
            />
          ) : (
            <ThemeSettingsPanel />
          )}
        </div>
      </div>
    </div>
  );
}
