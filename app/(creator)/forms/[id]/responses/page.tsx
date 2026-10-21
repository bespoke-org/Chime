import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ResponseExportActions } from "@/components/response-export-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthoredMarkdown } from "@/components/ui/authored-markdown";
import { ScrollHintPanel } from "@/components/ui/scroll-hint-panel";
import {
  AGREEMENT_ANSWER_VALUES,
  blockTypeTranslationKeys,
} from "@/lib/blocks";
import { requireServerSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getFunnelPercent } from "@/lib/form-funnel";
import { countFormVisits } from "@/lib/form-visits";
import { listResponsesForOwnedForm } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatResponseIdentity } from "@/lib/response-identity";
import { resolveTitle, withTitle } from "@/lib/metadata";
import type { QuestionSummary } from "@/lib/form-types";
import { cn, formatCalendarDate, formatDate } from "@/lib/utils";

async function getResponsesData(id: string) {
  const user = await requireServerSessionUser();

  try {
    return await listResponsesForOwnedForm(user.id, id);
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
  return resolved === "questions" ? "questions" : "submissions";
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
  const visits = await countFormVisits(form.id);
  const { view } = await searchParams;
  const currentView = resolveView(view);
  const workspaceLabel =
    form.workspace.kind === "personal"
      ? t("workspace.personal")
      : form.workspace.label;
  const numberFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  });
  const funnelSteps = [
    { key: "opened", count: visits.opened, percent: null },
    {
      key: "started",
      count: visits.started,
      percent: getFunnelPercent(visits.started, visits.opened),
    },
    {
      key: "submitted",
      count: responses.length,
      percent: getFunnelPercent(responses.length, visits.opened),
    },
  ] as const;
  const questionsHref = `/forms/${form.id}/responses?view=questions`;
  const submissionsHref = `/forms/${form.id}/responses`;

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
      <PageHeader
        title={form.title}
        metadata={workspaceLabel}
        actions={
          <>
            <Link href={`/forms/${form.id}/edit`}>
              <Button variant="secondary">
                {t("responses.backToBuilder")}
              </Button>
            </Link>
            <ResponseExportActions formId={form.id} />
          </>
        }
      />

      {/* Visits are counted per browser since tracking began, so the
          shares are capped at 100% and absent when no visit was recorded. */}
      <Card className="grid gap-4 p-5 sm:grid-cols-3">
        {funnelSteps.map((step) => (
          <div key={step.key}>
            <p className="text-xs font-semibold uppercase text-[var(--accent)]">
              {t(`responses.funnel.${step.key}`)}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
              {step.count}
              {step.key === "opened" ? null : (
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                  {step.percent === null ? "—" : `${step.percent}%`}
                </span>
              )}
            </p>
          </div>
        ))}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex h-12 items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[var(--surface-strong)] p-1">
          <Link
            href={questionsHref}
            className={cn(
              "inline-flex h-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
              currentView === "questions"
                ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
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
                ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
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
          form.status === "PUBLISHED" ? (
            <EmptyState
              title={t("responses.waitingForSubmissionsTitle")}
              description={t("responses.waitingForSubmissionsDescription", {
                path: `/f/${form.slug}`,
              })}
              action={
                <Link href={`/f/${form.slug}`} target="_blank">
                  <Button variant="secondary">
                    {t("responses.openPublicForm")}
                  </Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              title={t("responses.noSubmissionsTitle")}
              description={t("responses.noSubmissionsDescription")}
              action={
                <Link href={`/forms/${form.id}/edit`}>
                  <Button>{t("responses.openBuilder")}</Button>
                </Link>
              }
            />
          )
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-[color:var(--line)]">
              {responses.map((response) => (
                <div
                  key={response.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(140px,260px)_190px_120px_1fr] sm:items-center sm:gap-y-4 sm:gap-x-3"
                >
                  <div className="min-w-0 sm:justify-self-start">
                    {/* Identity fields name the respondent; without them
                        the submission number stands in. */}
                    <h2 className="truncate text-base font-semibold text-[var(--ink)] sm:text-left">
                      {response.identity.length
                        ? formatResponseIdentity(response.identity)
                        : t("meta.response", {
                            number: response.submissionNumber,
                          })}
                    </h2>
                  </div>
                  <p className="min-w-0 text-sm text-[var(--muted)] sm:justify-self-start sm:text-left">
                    {formatDate(response.submittedAt, locale)}
                  </p>
                  <p className="min-w-0 text-sm text-[var(--muted)] sm:justify-self-start sm:text-left">
                    {t("responses.answersCount", {
                      count: response.answerCount,
                    })}
                  </p>
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
                <AuthoredMarkdown
                  content={summary.block.description}
                  className="mt-3 text-sm leading-7 text-[var(--muted)]"
                />
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
                <div className="mt-6 overflow-hidden rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-start)]">
                  {summary.optionCounts.map((option, index) => (
                    <div
                      key={option.value}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-sm",
                        index % 2 === 0
                          ? "bg-transparent"
                          : "bg-[var(--bg-end)]",
                      )}
                    >
                      <span className="font-medium text-[var(--ink)]">
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
                <div className="mt-6 overflow-hidden rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-start)]">
                  {[
                    {
                      label: t("responses.minLabel"),
                      value:
                        summary.min === null
                          ? "—"
                          : numberFormatter.format(summary.min),
                    },
                    {
                      label: t("responses.averageLabel"),
                      value:
                        summary.average === null
                          ? "—"
                          : numberFormatter.format(summary.average),
                    },
                    {
                      label: t("responses.maxLabel"),
                      value:
                        summary.max === null
                          ? "—"
                          : numberFormatter.format(summary.max),
                    },
                  ].map((row, index) => (
                    <div
                      key={row.label}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-sm",
                        index % 2 === 0
                          ? "bg-transparent"
                          : "bg-[var(--bg-end)]",
                      )}
                    >
                      <span className="font-medium text-[var(--ink)]">
                        {row.label}
                      </span>
                      <span className="text-[var(--muted)]">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {summary.kind === "number" && summary.distribution ? (
                <div className="mt-3 overflow-hidden rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-start)]">
                  {summary.distribution.map((entry, index) => (
                    <div
                      key={entry.value}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-sm",
                        index % 2 === 0
                          ? "bg-transparent"
                          : "bg-[var(--bg-end)]",
                      )}
                    >
                      <span className="font-medium text-[var(--ink)]">
                        {entry.value}
                      </span>
                      <span className="text-[var(--muted)]">{entry.count}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {summary.kind === "freeform" ? (
                summary.answers.length === 0 ? (
                  <p className="mt-6 text-sm text-[var(--muted)]">
                    {t("responses.noAnswersYet")}
                  </p>
                ) : (
                  <ScrollHintPanel className="mt-6 max-h-80 overflow-y-auto rounded-[16px] border border-[color:var(--line)] bg-[var(--bg-start)] sm:max-h-96">
                    {summary.answers.map((answer, index) => (
                      <div
                        key={`${answer.responseId}-${answer.submissionNumber}-${index}`}
                        className={cn(
                          "grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4",
                          index % 2 === 0
                            ? "bg-transparent"
                            : "bg-[var(--bg-end)]",
                        )}
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
                        ) : summary.block.type === "FILE_UPLOAD" ? (
                          <a
                            href={`/api/forms/${form.id}/uploads/${answer.value}`}
                            className="text-sm leading-7 text-[var(--accent)] hover:underline"
                          >
                            {t("responses.downloadFile")}
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--ink)]">
                            {formatAnswerValue(summary, answer.value)}
                          </p>
                        )}
                        <Link
                          href={`/forms/${form.id}/responses/${answer.responseId}`}
                          className="justify-self-start self-center text-xs font-medium text-[var(--muted)] transition hover:text-[var(--ink)] sm:justify-self-end"
                        >
                          {t("meta.response", {
                            number: answer.submissionNumber,
                          })}
                        </Link>
                      </div>
                    ))}
                  </ScrollHintPanel>
                )
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
