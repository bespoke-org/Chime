import type { Metadata } from "next";

import { SettingsShell } from "@/components/settings-shell";
import { getServerAuthSession } from "@/lib/auth";
import { listOrganizationsForUser } from "@/lib/organizations";
import { getRequestI18n } from "@/lib/i18n-server";
import { withTitle } from "@/lib/metadata";
import { getProfileSettingsUser } from "@/lib/users";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();
  return withTitle(t("settings.shell.title"));
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    organization?: string | string[];
    section?: string | string[];
  }>;
}) {
  const session = await getServerAuthSession();
  const [organizations, profileUser] = await Promise.all([
    listOrganizationsForUser(session!.user.id),
    getProfileSettingsUser(session!.user.id),
  ]);
  const resolvedSearchParams = await searchParams;
  const initialOrganizationId = Array.isArray(resolvedSearchParams.organization)
    ? (resolvedSearchParams.organization[0] ?? null)
    : (resolvedSearchParams.organization ?? null);
  const initialSection = Array.isArray(resolvedSearchParams.section)
    ? (resolvedSearchParams.section[0] ?? "profile")
    : (resolvedSearchParams.section ?? "profile");

  return (
    <SettingsShell
      organizations={organizations}
      profileUser={profileUser}
      initialOrganizationId={initialOrganizationId}
      initialSection={initialSection}
    />
  );
}
