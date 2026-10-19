"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { createFormAction } from "@/app/(creator)/actions";
import { useI18n } from "@/components/i18n-provider";
import { FormStatusBadge } from "@/components/form-status-badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import type { FormListItem } from "@/lib/form-types";
import { formatDate } from "@/lib/utils";

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
  const { locale, t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
            <form action={createFormAction}>
              <Button size="lg" type="submit">
                <Plus className="size-4" />
                {t("dashboard.newForm")}
              </Button>
            </form>
          </div>
        }
      />

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
                    <FormStatusBadge
                      status={form.status}
                      closed={form.closed}
                    />
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
    </div>
  );
}
