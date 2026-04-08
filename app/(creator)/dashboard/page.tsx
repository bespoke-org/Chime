import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { listFormsForOwner } from "@/lib/forms";
import { formatDate } from "@/lib/utils";
import { createFormAction } from "@/app/(creator)/actions";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  const forms = await listFormsForOwner(session!.user.id);

  return (
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

      {forms.length === 0 ? (
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
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          {forms.map((form) => (
            <Card key={form.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge className={form.status === "PUBLISHED" ? "rounded-full bg-[var(--accent-soft)] text-[#2f5d35]" : "rounded-full bg-black/5"}>
                    {form.status === "PUBLISHED" ? "Published" : "Draft"}
                  </Badge>
                  <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">{form.title}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
                    {form.description || "No description yet."}
                  </p>
                </div>
                <Link href={`/forms/${form.id}/edit`}>
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
              </div>

              <div className="mt-6 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Share URL</p>
                  <p className="mt-2 truncate">/{form.slug}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Responses</p>
                  <p className="mt-2">{form.responseCount}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Updated</p>
                  <p className="mt-2">{formatDate(form.updatedAt)}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/forms/${form.id}/edit`}>
                  <Button>
                    Open builder
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href={`/forms/${form.id}/responses`}>
                  <Button variant="secondary">View responses</Button>
                </Link>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
