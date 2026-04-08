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
      <section className="flex flex-col gap-4 rounded-[32px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(235,247,235,0.92))] px-8 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Creator dashboard</p>
          <h1 className="font-display text-5xl leading-tight text-[var(--ink)]">Build linear forms that feel composed.</h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Start drafts fast, keep editing focused, and send people into a one-screen-at-a-time runner that stays
            anonymous on submission.
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
          title="Start with a draft and shape the conversation."
          description="Every new form begins with a welcome text block and a first question so you can immediately refine the flow."
          action={
            <form action={createFormAction}>
              <Button type="submit">
                <Plus className="size-4" />
                Create your first form
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
                  <Badge className={form.status === "PUBLISHED" ? "bg-[var(--accent-soft)] text-[#2f5d35]" : "bg-black/5"}>
                    {form.status === "PUBLISHED" ? "Published" : "Draft"}
                  </Badge>
                  <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">{form.title}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
                    {form.description || "No description yet — open the builder to shape the story of the form."}
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
