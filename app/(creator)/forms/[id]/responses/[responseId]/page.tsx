import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { AuthoredMarkdown } from "@/components/ui/authored-markdown";
import { AGREEMENT_ANSWER_VALUES } from "@/lib/blocks";
import { requireServerSessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import type { AnswerValue } from "@/lib/form-types";
import { getOwnedResponseDetail } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { formatResponseIdentity } from "@/lib/response-identity";
import { resolveStoredAnswerView } from "@/lib/response-review";
import { resolveTitle, withTitle } from "@/lib/metadata";
import { formatSizeMb } from "@/lib/uploads";
import { formatCalendarDate, formatDate } from "@/lib/utils";

async function getResponseData(id: string, responseId: string) {
  const user = await requireServerSessionUser();

  try {
    return await getOwnedResponseDetail(user.id, id, responseId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; responseId: string }>;
}): Promise<Metadata> {
  const { t } = await getRequestI18n();
  const { id, responseId } = await params;
  const response = await getResponseData(id, responseId);

  return withTitle(
    `${resolveTitle(response.formTitle, t("meta.untitledForm"))} — ${t("meta.response", { number: response.submissionNumber })}`,
  );
}

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string; responseId: string }>;
}) {
  const { locale, t } = await getRequestI18n();
  const { id, responseId } = await params;
  const response = await getResponseData(id, responseId);

  const workspaceLabel =
    response.workspace.kind === "personal"
      ? t("workspace.personal")
      : response.workspace.label;
  const blockTypeLabel = (type: string) => t(`blocks.types.${type}`);
  const submissionLabel = t("responseDetail.title", {
    number: response.submissionNumber,
    date: formatDate(response.submittedAt, locale),
  });

  // One answer value as the detail card shows it: a single selection list,
  // link, date, agreement, upload or plain text.
  const renderAnswerValue = (type: string, value: AnswerValue | undefined) => {
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item) => (
            <Badge
              key={item}
              className="bg-[var(--surface-strong)] text-[var(--ink)]"
            >
              {item}
            </Badge>
          ))}
        </div>
      );
    }

    if (!value) {
      return (
        <p className="text-sm text-[var(--muted)]">
          {t("responseDetail.noAnswer")}
        </p>
      );
    }

    if (type === "LINK") {
      return (
        <Link
          href={value}
          target="_blank"
          rel="noreferrer"
          className="break-all text-base leading-8 text-[var(--accent)] hover:underline"
        >
          {value}
        </Link>
      );
    }

    if (type === "DATE") {
      return (
        <p className="whitespace-pre-wrap text-base leading-8">
          {formatCalendarDate(value, locale)}
        </p>
      );
    }

    if (type === "AGREEMENT") {
      return (
        <p className="whitespace-pre-wrap text-base leading-8">
          {value === AGREEMENT_ANSWER_VALUES.AGREED
            ? t("publicRunner.agree")
            : t("publicRunner.doNotAgree")}
        </p>
      );
    }

    if (type === "FILE_UPLOAD") {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all text-base leading-8">
              {response.uploads[value]?.filename ??
                t("responseDetail.noAnswer")}
            </p>
            {response.uploads[value] ? (
              <p className="text-sm text-[var(--muted)]">
                {t("responseDetail.fileSize", {
                  size: formatSizeMb(response.uploads[value].size),
                })}
              </p>
            ) : null}
          </div>
          {response.uploads[value] ? (
            <a
              href={`/api/forms/${id}/uploads/${value}`}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              {t("responseDetail.downloadFile")}
            </a>
          ) : null}
        </div>
      );
    }

    return <p className="whitespace-pre-wrap text-base leading-8">{value}</p>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          response.identity.length
            ? formatResponseIdentity(response.identity)
            : submissionLabel
        }
        metadata={workspaceLabel}
        description={response.identity.length ? submissionLabel : undefined}
        actions={
          <Link href={`/forms/${id}/responses`}>
            <Button variant="secondary">
              {t("responseDetail.backToResponses")}
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {response.blocks.map((block) => {
          const answerView = resolveStoredAnswerView(
            block,
            response.answers[block.id],
          );

          if (block.type === "TEXT") {
            return (
              <section key={block.id} className="px-2 pt-6">
                <h2 className="text-lg font-semibold text-[var(--muted)]">
                  {block.title || t("responseDetail.contextTitle")}
                </h2>
                {block.description ? (
                  <AuthoredMarkdown
                    content={block.description}
                    className="mt-3 text-sm leading-7 text-[var(--muted)]"
                  />
                ) : null}
                {"body" in block.config ? (
                  <AuthoredMarkdown
                    content={block.config.body}
                    className="mt-4 text-base leading-8 text-[var(--muted)]"
                  />
                ) : null}
              </section>
            );
          }

          return (
            <Card key={block.id} className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{blockTypeLabel(block.type)}</Badge>
                {block.required ? (
                  <Badge className="bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                    {t("responseDetail.required")}
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-4 text-xl font-semibold text-[var(--ink)]">
                {block.title}
              </h2>
              {block.description ? (
                <AuthoredMarkdown
                  content={block.description}
                  className="mt-3 text-sm leading-7 text-[var(--muted)]"
                />
              ) : null}
              <div className="mt-6 border-l-2 border-[var(--accent)] pl-4 text-[var(--ink)]/80">
                {answerView.kind === "instances" ? (
                  answerView.entries.length ? (
                    // A repeating page leaves one entry per answered
                    // instance, labeled by its instance number.
                    <div className="space-y-5">
                      {answerView.entries.map((entry) => (
                        <div key={entry.instanceIndex}>
                          <p className="text-sm font-medium text-[var(--muted)]">
                            {t("formPages.instanceShortLabel", {
                              number: entry.instanceIndex + 1,
                            })}
                          </p>
                          <div className="mt-2">
                            {renderAnswerValue(block.type, entry.value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      {t("responseDetail.noAnswer")}
                    </p>
                  )
                ) : (
                  renderAnswerValue(block.type, answerView.value)
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
