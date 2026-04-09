import { SettingsShell } from "@/components/settings-shell";
import { getServerAuthSession } from "@/lib/auth";
import { listOrganizationsForUser } from "@/lib/organizations";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string | string[] }>;
}) {
  const session = await getServerAuthSession();
  const organizations = await listOrganizationsForUser(session!.user.id);
  const resolvedSearchParams = await searchParams;
  const initialOrganizationId = Array.isArray(resolvedSearchParams.organization)
    ? resolvedSearchParams.organization[0] ?? null
    : resolvedSearchParams.organization ?? null;

  return <SettingsShell organizations={organizations} initialOrganizationId={initialOrganizationId} />;
}
