import type { Metadata } from "next";

import { SettingsShell } from "@/components/settings-shell";
import { requireServerSessionUser } from "@/lib/auth";
import { getDigestTimezone } from "@/lib/digest-schedule";
import { listOrganizationsForUser } from "@/lib/organizations";
import { getRequestI18n, resolveLocaleForUser } from "@/lib/i18n-server";
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
  const user = await requireServerSessionUser();
  const [organizations, profileUser] = await Promise.all([
    listOrganizationsForUser(user.id),
    getProfileSettingsUser(user.id, await resolveLocaleForUser(user.locale)),
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
      digestTimezone={getDigestTimezone()}
    />
  );
}
