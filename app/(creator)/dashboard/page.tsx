import { Plus } from "lucide-react";

import { createFormAction } from "@/app/(creator)/actions";
import { DashboardFormBrowser } from "@/components/dashboard-form-browser";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getServerAuthSession } from "@/lib/auth";
import { listFormsForWorkspace } from "@/lib/forms";
import { getActiveWorkspaceForUser } from "@/lib/workspaces";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  const workspaceState = await getActiveWorkspaceForUser(session!.user.id);
  const forms = await listFormsForWorkspace(session!.user.id, workspaceState.activeWorkspace);
  const workspaceLabel = workspaceState.activeOption.label;

  return forms.length === 0 ? (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Dashboard</p>
          <h1 className="font-display text-4xl leading-tight text-[var(--ink)]">{workspaceLabel}</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Create a form, open a draft, or review responses in the active workspace.
          </p>
        </div>
        <form action={createFormAction}>
          <Button size="lg" type="submit">
            <Plus className="size-4" />
            New form
          </Button>
        </form>
      </section>

      <EmptyState
        eyebrow="No forms yet"
        title={`Create the first form in ${workspaceLabel}`}
        description="New forms start as drafts so you can edit before publishing."
        action={
          <form action={createFormAction}>
            <Button type="submit">
              <Plus className="size-4" />
              New form
            </Button>
          </form>
        }
      />
    </div>
  ) : (
    <DashboardFormBrowser forms={forms} workspaceLabel={workspaceLabel} />
  );
}
