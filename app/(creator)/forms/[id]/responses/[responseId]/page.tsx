import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getOwnedResponseDetail } from "@/lib/forms";
import { formatDate } from "@/lib/utils";

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string; responseId: string }>;
}) {
  const session = await getServerAuthSession();
  const { id, responseId } = await params;

  let response;

  try {
    response = await getOwnedResponseDetail(session!.user.id, id, responseId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Submission replay</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">Submission #{response.submissionNumber} · {formatDate(response.submittedAt)}</h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">{response.workspace.label}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Review submitted answers in form order.</p>
        </div>
        <Link href={`/forms/${id}/responses`}>
          <Button variant="secondary">Back to responses</Button>
        </Link>
      </section>

      <div className="space-y-4">
        {response.blocks.map((block) => {
          const answer = response.answers[block.id];

          if (block.type === "TEXT") {
            return (
              <Card key={block.id} className="border-dashed bg-[var(--bg-strong)] p-6">
                <Badge>Context block</Badge>
                <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">{block.title || "Context"}</h2>
                {block.description ? <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{block.description}</p> : null}
                {"body" in block.config ? <p className="mt-4 text-base leading-8 text-[var(--ink)]/85">{block.config.body}</p> : null}
              </Card>
            );
          }

          return (
            <Card key={block.id} className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{block.type.replaceAll("_", " ")}</Badge>
                {block.required ? <Badge className="bg-[var(--accent-soft)] text-[var(--accent-ink)]">Required</Badge> : null}
              </div>
              <h2 className="mt-4 font-display text-3xl text-[var(--ink)]">{block.title}</h2>
              {block.description ? <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{block.description}</p> : null}
              <div className="mt-6 rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] px-5 py-4 text-[var(--ink)]">
                {Array.isArray(answer) ? (
                  <div className="flex flex-wrap gap-2">
                    {answer.map((value) => (
                      <Badge key={value} className="bg-[var(--surface-strong)] text-[var(--ink)]">
                        {value}
                      </Badge>
                    ))}
                  </div>
                ) : answer ? (
                  <p className="whitespace-pre-wrap text-base leading-8">{answer}</p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">No answer provided.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
