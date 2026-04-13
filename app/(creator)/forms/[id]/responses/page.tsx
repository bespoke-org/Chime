import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ResponseExportActions } from "@/components/response-export-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AGREEMENT_ANSWER_VALUES,
  blockTypeTranslationKeys,
} from "@/lib/blocks";
import { getServerAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { listResponsesForOwnedForm } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { resolveTitle, withTitle } from "@/lib/metadata";
import type { QuestionSummary } from "@/lib/form-types";
import { cn, formatCalendarDate, formatDate } from "@/lib/utils";

async function getResponsesData(id: string) {
  const session = await getServerAuthSession();

  try {
    return await listResponsesForOwnedForm(session!.user.id, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

type ResponseReviewView = "submissions" | "questions";

function resolveView(value: string | string[] | undefined): ResponseReviewView {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved === "submissions" ? "submissions" : "questions";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { t } = await getRequestI18n();
  const { id } = await params;
  const { form } = await getResponsesData(id);

  return withTitle(
    `${resolveTitle(form.title, t("meta.untitledForm"))} — ${t("meta.responses")}`,
  );
}

export default async function ResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { locale, t } = await getRequestI18n();
  const { id } = await params;
  const { form, responses, questionSummaries } = await getResponsesData(id);
  const { view } = await searchParams;
  const currentView = resolveView(view);
  const workspaceLabel =
    form.workspace.kind === "personal"
      ? t("workspace.personal")
      : form.workspace.label;
  const numberFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  });
  const questionsHref = `/forms/${form.id}/responses`;
  const submissionsHref = `/forms/${form.id}/responses?view=submissions`;

  function formatAnswerValue(summary: QuestionSummary, value: string) {
    if (summary.block.type === "DATE") {
      return formatCalendarDate(value, locale);
    }

    return value;
  }

  function getOptionLabel(summary: QuestionSummary, value: string) {
    if (summary.block.type !== "AGREEMENT") {
      return value;
    }

    return value === AGREEMENT_ANSWER_VALUES.AGREED
      ? t("publicRunner.agree")
      : t("publicRunner.doNotAgree");
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-4xl text-[var(--ink)]">
            {form.title}
          </h1>
          <p className="mt-2 text-xs font-medium uppercase text-[var(--muted)]">
            {workspaceLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link href={`/forms/${form.id}/edit`}>
            <Button variant="secondary">{t("responses.backToBuilder")}</Button>
          </Link>
          <ResponseExportActions formId={form.id} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex h-12 items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-1">
          <Link
            href={questionsHref}
            className={cn(
              "inline-flex h-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
              currentView === "questions"
                ? "!bg-[var(--ink)] !text-[var(--bg)]"
                : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
            )}
            aria-current={currentView === "questions" ? "page" : undefined}
          >
            {t("responses.viewQuestions")}
          </Link>
          <Link
            href={submissionsHref}
            className={cn(
              "inline-flex h-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
              currentView === "submissions"
                ? "!bg-[var(--ink)] !text-[var(--bg)]"
                : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
            )}
            aria-current={currentView === "submissions" ? "page" : undefined}
          >
            {t("responses.viewSubmissions")}
          </Link>
        </div>
        <div className="inline-flex h-12 items-center rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-1">
          <div className="inline-flex h-full items-center rounded-lg px-3 text-sm font-medium text-[var(--ink)]">
            {t("responses.submissionsCount", { count: responses.length })}
          </div>
        </div>
      </div>

      {currentView === "submissions" ? (
        responses.length === 0 ? (
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
                <div
                  key={response.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <h2 className="font-display text-2xl text-[var(--ink)]">
                        {t("responses.submissionTitle", {
                          number: response.submissionNumber,
                          date: formatDate(response.submittedAt, locale),
                        })}
                      </h2>
                      <p className="text-sm text-[var(--muted)]">
                        {t("responses.answersCount", {
                          count: response.answerCount,
                        })}
                      </p>
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
        )
      ) : questionSummaries.length === 0 ? (
        <EmptyState
          eyebrow={t("responses.noQuestionBlocksEyebrow")}
          title={t("responses.noQuestionBlocksTitle")}
          description={t("responses.noQuestionBlocksDescription")}
          action={
            <Link href={`/forms/${form.id}/edit`}>
              <Button>{t("responses.openBuilder")}</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {questionSummaries.map((summary) => (
            <Card key={summary.block.id} className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{t(blockTypeTranslationKeys[summary.block.type])}</Badge>
                {summary.block.required ? (
                  <Badge className="bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                    {t("responseDetail.required")}
                  </Badge>
                ) : null}
              </div>

              <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">
                {summary.block.title}
              </h2>
              {summary.block.description ? (
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {summary.block.description}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-2">
                <Badge className="bg-[var(--surface-strong)] text-[var(--ink)]">
                  {t("responses.reachedCount", { count: summary.reachedCount })}
                </Badge>
                <Badge className="bg-[var(--surface-strong)] text-[var(--ink)]">
                  {t("responses.answeredCount", {
                    count: summary.answeredCount,
                  })}
                </Badge>
                <Badge className="bg-[var(--surface-strong)] text-[var(--ink)]">
                  {t("responses.emptyCount", { count: summary.emptyCount })}
                </Badge>
                <Badge className="bg-[var(--surface-strong)] text-[var(--ink)]">
                  {t("responses.skippedCount", { count: summary.skippedCount })}
                </Badge>
              </div>

              {summary.kind === "choice" ? (
                <div className="mt-6 grid gap-3">
                  {summary.optionCounts.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center justify-between rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]"
                    >
                      <span className="font-medium">
                        {getOptionLabel(summary, option.value)}
                      </span>
                      <span className="text-[var(--muted)]">
                        {option.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {summary.kind === "number" ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]">
                    <p className="text-[var(--muted)]">
                      {t("responses.minValue", {
                        value:
                          summary.min === null
                            ? "—"
                            : numberFormatter.format(summary.min),
                      })}
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]">
                    <p className="text-[var(--muted)]">
                      {t("responses.maxValue", {
                        value:
                          summary.max === null
                            ? "—"
                            : numberFormatter.format(summary.max),
                      })}
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-4 py-3 text-sm text-[var(--ink)]">
                    <p className="text-[var(--muted)]">
                      {t("responses.averageValue", {
                        value:
                          summary.average === null
                            ? "—"
                            : numberFormatter.format(summary.average),
                      })}
                    </p>
                  </div>
                </div>
              ) : null}

              {summary.kind === "freeform" ? (
                <div className="mt-6 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] p-4">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {t("responses.answerList")}
                  </p>
                  {summary.answers.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      {t("responses.noAnswersYet")}
                    </p>
                  ) : (
                    <div className="mt-3 divide-y divide-[color:var(--line)]">
                      {summary.answers.map((answer, index) => (
                        <div
                          key={`${answer.responseId}-${answer.submissionNumber}-${index}`}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          {summary.block.type === "LINK" ? (
                            <Link
                              href={answer.value}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-sm leading-7 text-[var(--accent)] hover:underline"
                            >
                              {answer.value}
                            </Link>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--ink)]">
                              {formatAnswerValue(summary, answer.value)}
                            </p>
                          )}
                          <Link
                            href={`/forms/${form.id}/responses/${answer.responseId}`}
                            className="text-xs font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
                          >
                            {t("meta.response", {
                              number: answer.submissionNumber,
                            })}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {summary.kind !== "freeform" && summary.answeredCount === 0 ? (
                <p className="mt-6 text-sm text-[var(--muted)]">
                  {t("responses.noAnswersYet")}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
