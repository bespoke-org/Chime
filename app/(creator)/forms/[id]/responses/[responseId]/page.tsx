import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthoredMarkdown } from "@/components/ui/authored-markdown";
import { AGREEMENT_ANSWER_VALUES } from "@/lib/blocks";
import { getServerAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getOwnedResponseDetail } from "@/lib/forms";
import { getRequestI18n } from "@/lib/i18n-server";
import { resolveTitle, withTitle } from "@/lib/metadata";
import { formatCalendarDate, formatDate } from "@/lib/utils";

async function getResponseData(id: string, responseId: string) {
  const session = await getServerAuthSession();

  try {
    return await getOwnedResponseDetail(session!.user.id, id, responseId);
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

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-4xl text-[var(--ink)]">
            {t("responseDetail.title", {
              number: response.submissionNumber,
              date: formatDate(response.submittedAt, locale),
            })}
          </h1>
          <p className="mt-2 text-xs font-medium uppercase text-[var(--muted)]">
            {workspaceLabel}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t("responseDetail.description")}
          </p>
        </div>
        <Link href={`/forms/${id}/responses`}>
          <Button variant="secondary">
            {t("responseDetail.backToResponses")}
          </Button>
        </Link>
      </section>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{t("responseDetail.routeContext")}</Badge>
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl text-[var(--ink)]">
              {t("responseDetail.visitedPath")}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {response.routeBlocks
                .filter((entry) => entry.status === "visited")
                .map((entry) => (
                  <Badge
                    key={entry.block.id}
                    className="bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  >
                    {entry.block.title || blockTypeLabel(entry.block.type)}
                  </Badge>
                ))}
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl text-[var(--ink)]">
              {t("responseDetail.skippedPath")}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {response.routeBlocks.filter(
                (entry) => entry.status === "skipped",
              ).length ? (
                response.routeBlocks
                  .filter((entry) => entry.status === "skipped")
                  .map((entry) => (
                    <Badge
                      key={entry.block.id}
                      className="bg-[var(--surface-strong)] text-[var(--muted)]"
                    >
                      {entry.block.title || blockTypeLabel(entry.block.type)}
                    </Badge>
                  ))
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  {t("responseDetail.nothingSkipped")}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {response.blocks.map((block) => {
          const answer = response.answers[block.id];

          if (block.type === "TEXT") {
            return (
              <Card
                key={block.id}
                className="border-dashed bg-[var(--bg-strong)] p-6"
              >
                <Badge>{t("responseDetail.contextBlock")}</Badge>
                <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">
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
                    className="mt-4 text-base leading-8 text-[var(--ink)]/85"
                  />
                ) : null}
              </Card>
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
              <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">
                {block.title}
              </h2>
              {block.description ? (
                <AuthoredMarkdown
                  content={block.description}
                  className="mt-3 text-sm leading-7 text-[var(--muted)]"
                />
              ) : null}
              <div className="mt-6 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-5 py-4 text-[var(--ink)]">
                {Array.isArray(answer) ? (
                  <div className="flex flex-wrap gap-2">
                    {answer.map((value) => (
                      <Badge
                        key={value}
                        className="bg-[var(--surface-strong)] text-[var(--ink)]"
                      >
                        {value}
                      </Badge>
                    ))}
                  </div>
                ) : answer ? (
                  block.type === "LINK" ? (
                    <Link
                      href={answer}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-base leading-8 text-[var(--accent)] hover:underline"
                    >
                      {answer}
                    </Link>
                  ) : block.type === "DATE" ? (
                    <p className="whitespace-pre-wrap text-base leading-8">
                      {formatCalendarDate(answer, locale)}
                    </p>
                  ) : block.type === "AGREEMENT" ? (
                    <p className="whitespace-pre-wrap text-base leading-8">
                      {answer === AGREEMENT_ANSWER_VALUES.AGREED
                        ? t("publicRunner.agree")
                        : t("publicRunner.doNotAgree")}
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap text-base leading-8">
                      {answer}
                    </p>
                  )
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    {t("responseDetail.noAnswer")}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
