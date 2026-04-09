"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, LayoutGrid, Plus, TableProperties } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { createFormAction } from "@/app/(creator)/actions";
import { FormStatusBadge } from "@/components/form-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FormListItem } from "@/lib/form-types";
import { cn, formatDate } from "@/lib/utils";

type DashboardView = "grid" | "table";
type SortKey = "title" | "status" | "responseCount" | "updatedAt";
type SortDirection = "asc" | "desc";

const statusOrder = {
  DRAFT: 0,
  PUBLISHED: 1,
} as const;

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function DashboardFormBrowser({ forms, workspaceLabel }: { forms: FormListItem[]; workspaceLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") === "table" ? "table" : "grid";

  const [view, setView] = useState<DashboardView>(initialView);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    setView(searchParams.get("view") === "table" ? "table" : "grid");
  }, [searchParams]);

  function setDashboardView(nextView: DashboardView) {
    setView(nextView);

    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextView === "grid") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", nextView);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  const sortedForms = useMemo(() => {
    const next = [...forms];

    next.sort((left, right) => {
      let comparison = 0;

      switch (sortKey) {
        case "title":
          comparison = compareText(left.title, right.title);
          break;
        case "status":
          comparison = statusOrder[left.status] - statusOrder[right.status];
          break;
        case "responseCount":
          comparison = left.responseCount - right.responseCount;
          break;
        case "updatedAt":
          comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
          break;
      }

      if (comparison === 0) {
        comparison = compareText(left.title, right.title);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return next;
  }, [forms, sortDirection, sortKey]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "updatedAt" || nextKey === "responseCount" ? "desc" : "asc");
  }

  function renderSortIcon(key: SortKey) {
    if (sortKey !== key) {
      return <ArrowDown className="size-3.5 opacity-35" />;
    }

    return sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Dashboard</p>
          <h1 className="font-display text-4xl leading-tight text-[var(--ink)]">{workspaceLabel}</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">Create a form, open a draft, or review responses in the active workspace.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex h-12 items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-1">
            <button
              type="button"
              onClick={() => setDashboardView("grid")}
              className={cn(
                "inline-flex h-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
                view === "grid" ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
              )}
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="size-4" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setDashboardView("table")}
              className={cn(
                "inline-flex h-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
                view === "table" ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
              )}
              aria-pressed={view === "table"}
            >
              <TableProperties className="size-4" />
              Table
            </button>
          </div>
          <form action={createFormAction}>
            <Button size="lg" type="submit">
              <Plus className="size-4" />
              New form
            </Button>
          </form>
        </div>
      </section>

      {view === "grid" ? (
        <section className="grid gap-5 lg:grid-cols-2">
          {sortedForms.map((form) => (
            <Card key={form.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl text-[var(--ink)]">{form.title}</h2>
                    <FormStatusBadge status={form.status} />
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">{form.description || "No description yet."}</p>
                </div>
                <Link href={`/forms/${form.id}/edit`}>
                  <Button size="sm">Open</Button>
                </Link>
              </div>

              <div className="mt-6 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Share URL</p>
                  <p className="mt-2 truncate font-mono text-[13px]">/{form.slug}</p>
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

            </Card>
          ))}
        </section>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--line)] text-left">
              <thead className="bg-[var(--bg-strong)] border-b border-[color:var(--line)] shadow-[inset_0_-1px_0_rgba(23,23,23,0.06)]">
                <tr className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => handleSort("title")} className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]">
                      Title
                      {renderSortIcon("title")}
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => handleSort("status")} className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]">
                      Status
                      {renderSortIcon("status")}
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => handleSort("responseCount")} className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]">
                      Responses
                      {renderSortIcon("responseCount")}
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => handleSort("updatedAt")} className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]">
                      Updated
                      {renderSortIcon("updatedAt")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)] bg-[var(--surface-strong)] text-sm text-[var(--ink)]">
                {sortedForms.map((form) => (
                  <tr key={form.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="min-w-[220px]">
                        <Link href={`/forms/${form.id}/edit`} className="font-medium text-[var(--ink)] transition hover:text-[var(--accent)]">
                          {form.title}
                        </Link>
                        <p className="mt-1 truncate text-sm text-[var(--muted)]">{form.description || "No description yet."}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <FormStatusBadge status={form.status} />
                    </td>
                    <td className="px-5 py-4 text-[var(--muted)]">{form.responseCount}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{formatDate(form.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
