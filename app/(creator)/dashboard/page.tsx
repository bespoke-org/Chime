import { Plus } from "lucide-react";

import { createFormAction } from "@/app/(creator)/actions";
import { DashboardFormBrowser } from "@/components/dashboard-form-browser";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getServerAuthSession } from "@/lib/auth";
import { listFormsForWorkspace } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  const { t } = await getRequestI18n();
  const workspaceState = await getActiveWorkspaceForUser(session!.user.id);
  const forms = await listFormsForWorkspace(
    session!.user.id,
    workspaceState.activeWorkspace,
  );
  const workspaceLabel =
    workspaceState.activeOption.kind === "personal"
      ? t("workspace.personal")
      : workspaceState.activeOption.label;

  return forms.length === 0 ? (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-4xl leading-tight text-[var(--ink)]">
            {workspaceLabel}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t("dashboard.description")}
          </p>
        </div>
        <form action={createFormAction}>
          <Button size="lg" type="submit">
            <Plus className="size-4" />
            {t("dashboard.newForm")}
          </Button>
        </form>
      </section>

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
