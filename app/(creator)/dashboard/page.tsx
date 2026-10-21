import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { cache } from "react";

import { createFormAction } from "@/app/(creator)/actions";
import { DashboardFormBrowser } from "@/components/dashboard-form-browser";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requireServerSessionUser } from "@/lib/auth";
import { listFormsForWorkspace } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces";
import { withTitle } from "@/lib/metadata";

// Shared by generateMetadata and the page so the forms are loaded once.
const getDashboardData = cache(async () => {
  const user = await requireServerSessionUser();
  const { t } = await getRequestI18n();
  const workspaceState = await getActiveWorkspaceForUser(user.id);
  const forms = await listFormsForWorkspace(
    user.id,
    workspaceState.activeWorkspace,
  );
  const workspaceLabel =
    workspaceState.activeOption.kind === "personal"
      ? t("workspace.personal")
      : workspaceState.activeOption.label;

  return { forms, workspaceLabel };
});

export async function generateMetadata(): Promise<Metadata> {
  const { workspaceLabel } = await getDashboardData();
  return withTitle(workspaceLabel);
}

export default async function DashboardPage() {
  const { t } = await getRequestI18n();
  const { forms, workspaceLabel } = await getDashboardData();

  return forms.length === 0 ? (
    <div className="space-y-8">
      <PageHeader
        title={workspaceLabel}
        description={t("dashboard.description")}
        descriptionClassName="max-w-2xl"
        titleClassName="leading-tight"
        className="border-b-0 pb-0"
        actions={
          <form action={createFormAction}>
            <Button type="submit">
              <Plus className="size-4" />
              {t("dashboard.newForm")}
            </Button>
          </form>
        }
      />

      <EmptyState
        eyebrow={t("dashboard.noFormsEyebrow")}
        title={t("dashboard.noFormsTitle", { workspace: workspaceLabel })}
        description={t("dashboard.noFormsDescription")}
        action={
          <form action={createFormAction}>
            <Button type="submit">
              <Plus className="size-4" />
              {t("dashboard.newForm")}
            </Button>
          </form>
        }
      />
    </div>
  ) : (
    <DashboardFormBrowser forms={forms} workspaceLabel={workspaceLabel} />
  );
}
