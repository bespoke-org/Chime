import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ResponseExportActions } from "@/components/response-export-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { listResponsesForOwnedForm } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatDate } from "@/lib/utils";

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  const { locale, t } = await getRequestI18n();
  const { id } = await params;

  let form;
  let responses;

  try {
    const payload = await listResponsesForOwnedForm(session!.user.id, id);
    form = payload.form;
    responses = payload.responses;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  const workspaceLabel = form.workspace.kind === "personal" ? t("workspace.personal") : form.workspace.label;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-4xl text-[var(--ink)]">{form.title}</h1>
          <p className="mt-2 text-xs font-medium uppercase text-[var(--muted)]">{workspaceLabel}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("responses.description")}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Badge>{t("responses.submissionsCount", { count: responses.length })}</Badge>
          <ResponseExportActions formId={form.id} />
          <Link href={`/forms/${form.id}/edit`}>
            <Button variant="secondary">{t("responses.backToBuilder")}</Button>
          </Link>
        </div>
      </section>

      {responses.length === 0 ? (
        <EmptyState
          eyebrow={t("responses.noSubmissionsEyebrow")}
          title={t("responses.noSubmissionsTitle")}
          description={t("responses.noSubmissionsDescription")}
          action={
            <Link href={`/forms/${form.id}/edit`}>
              <Button>{t("responses.openBuilder")}</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-[color:var(--line)]">
            {responses.map((response) => (
              <div key={response.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <h2 className="font-display text-2xl text-[var(--ink)]">{t("responses.submissionTitle", { number: response.submissionNumber, date: formatDate(response.submittedAt, locale) })}</h2>
                    <p className="text-sm text-[var(--muted)]">{t("responses.answersCount", { count: response.answerCount })}</p>
                  </div>
                </div>
                <div className="sm:flex sm:justify-end">
                  <Link href={`/forms/${form.id}/responses/${response.id}`}>
                    <Button size="sm" variant="secondary">
                      {t("responses.open")}
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
