"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  Plus,
  TableProperties,
} from "lucide-react";
import { useMemo, useState } from "react";

import { createFormAction } from "@/app/(creator)/actions";
import { useI18n } from "@/components/i18n-provider";
import { FormStatusBadge } from "@/components/form-status-badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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

export function DashboardFormBrowser({
  forms,
  workspaceLabel,
}: {
  forms: FormListItem[];
  workspaceLabel: string;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: DashboardView =
    searchParams.get("view") === "table" ? "table" : "grid";

  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function setDashboardView(nextView: DashboardView) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextView === "grid") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", nextView);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
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
          comparison =
            new Date(left.updatedAt).getTime() -
            new Date(right.updatedAt).getTime();
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
    setSortDirection(
      nextKey === "updatedAt" || nextKey === "responseCount" ? "desc" : "asc",
    );
  }

  function renderSortIcon(key: SortKey) {
    if (sortKey !== key) {
      return <ArrowDown className="size-3.5 opacity-35" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={workspaceLabel}
        description={t("dashboard.description")}
        descriptionClassName="max-w-2xl"
        titleClassName="leading-tight"
        className="pb-6"
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex h-12 items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-1">
              <button
                type="button"
                onClick={() => setDashboardView("grid")}
                className={cn(
                  "inline-flex h-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
                  view === "grid"
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
                )}
                aria-pressed={view === "grid"}
              >
                <LayoutGrid className="size-4" />
                {t("dashboard.viewGrid")}
              </button>
              <button
                type="button"
                onClick={() => setDashboardView("table")}
                className={cn(
                  "inline-flex h-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
                  view === "table"
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
                )}
                aria-pressed={view === "table"}
              >
                <TableProperties className="size-4" />
                {t("dashboard.viewTable")}
              </button>
            </div>
            <form action={createFormAction}>
              <Button size="lg" type="submit">
                <Plus className="size-4" />
                {t("dashboard.newForm")}
              </Button>
            </form>
          </div>
        }
      />

      {view === "grid" ? (
        <section className="grid gap-5 lg:grid-cols-2">
          {sortedForms.map((form) => (
            <Card key={form.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl text-[var(--ink)]">
                      {form.title}
                    </h2>
                    <FormStatusBadge status={form.status} />
                  </div>
                </div>
                <Link href={`/forms/${form.id}/edit`}>
                  <Button size="sm">{t("dashboard.open")}</Button>
                </Link>
              </div>

              <div className="mt-6 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--accent)]">
                    {t("dashboard.shareUrl")}
                  </p>
                  <p className="mt-2 truncate font-mono text-[13px]">
                    /{form.slug}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--accent)]">
                    {t("dashboard.responses")}
                  </p>
                  <p className="mt-2">{form.responseCount}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--accent)]">
                    {t("dashboard.updated")}
                  </p>
                  <p className="mt-2">{formatDate(form.updatedAt, locale)}</p>
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
                <tr className="text-xs uppercase text-[var(--muted)]">
                  <th className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => handleSort("title")}
                      className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]"
                    >
                      {t("dashboard.titleColumn")}
                      {renderSortIcon("title")}
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]"
                    >
                      {t("dashboard.statusColumn")}
                      {renderSortIcon("status")}
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => handleSort("responseCount")}
                      className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]"
                    >
                      {t("dashboard.responses")}
                      {renderSortIcon("responseCount")}
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => handleSort("updatedAt")}
                      className="inline-flex items-center gap-2 font-semibold transition hover:text-[var(--ink)]"
                    >
                      {t("dashboard.updated")}
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
                        <Link
                          href={`/forms/${form.id}/edit`}
                          className="font-medium text-[var(--ink)] transition hover:text-[var(--accent)]"
                        >
                          {form.title}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <FormStatusBadge status={form.status} />
                    </td>
                    <td className="px-5 py-4 text-[var(--muted)]">
                      {form.responseCount}
                    </td>
                    <td className="px-5 py-4 text-[var(--muted)]">
                      {formatDate(form.updatedAt, locale)}
                    </td>
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
