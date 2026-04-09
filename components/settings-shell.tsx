"use client";

import { Building2, Palette } from "lucide-react";
import { useState } from "react";

import { OrganizationSettingsPanel } from "@/components/organization-settings-panel";
import { ThemeSettingsPanel } from "@/components/theme-settings-panel";
import { cn } from "@/lib/utils";
import type { OrganizationSettingsSummary } from "@/lib/form-types";

type SettingsSection = "organizations" | "appearance";

const sectionMeta: Record<SettingsSection, { title: string; icon: typeof Building2; description: string }> = {
  organizations: {
    title: "Organizations",
    icon: Building2,
    description: "Members, invites, and owner controls.",
  },
  appearance: {
    title: "Appearance",
    icon: Palette,
    description: "Theme and visual preferences.",
  },
};

export function SettingsShell({
  organizations,
  initialOrganizationId,
}: {
  organizations: OrganizationSettingsSummary[];
  initialOrganizationId: string | null;
}) {
  const [selection, setSelection] = useState<SettingsSection>("organizations");

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Settings</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">Workspace and site preferences</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Manage shared workspaces and choose how Lively Forms looks across creator pages and public forms.
          </p>
        </div>
      </section>

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
                onClick={() => setSelection(section)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition",
                  selected
                    ? "bg-[var(--surface-strong)] text-[var(--ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
                )}
              >
                <div className={cn(
                  "rounded-full p-1.5",
                  selected ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "bg-[var(--bg-strong)] text-[var(--muted)]",
                )}>
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{meta.title}</p>
                  <p className="mt-1 truncate text-xs opacity-80">{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0">
          {selection === "organizations" ? (
            <OrganizationSettingsPanel organizations={organizations} initialOrganizationId={initialOrganizationId} />
          ) : (
            <ThemeSettingsPanel />
          )}
        </div>
      </div>
    </div>
  );
}
