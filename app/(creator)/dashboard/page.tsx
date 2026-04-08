import { Plus } from "lucide-react";

import { createFormAction } from "@/app/(creator)/actions";
import { DashboardFormBrowser } from "@/components/dashboard-form-browser";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getServerAuthSession } from "@/lib/auth";
import { listFormsForOwner } from "@/lib/forms";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  const forms = await listFormsForOwner(session!.user.id);

  return forms.length === 0 ? (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-black/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Dashboard</p>
          <h1 className="font-display text-4xl leading-tight text-[var(--ink)]">Your forms</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Create a form, open a draft, or review responses.
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
        title="Create your first form"
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
    <DashboardFormBrowser forms={forms} />
  );
}
