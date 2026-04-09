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
import { formatDate } from "@/lib/utils";

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
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

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Responses</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">{form.title}</h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">{form.workspace.label}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Review anonymous submissions in form order.</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Badge>{responses.length} submissions</Badge>
          <ResponseExportActions formId={form.id} />
          <Link href={`/forms/${form.id}/edit`}>
            <Button variant="secondary">Back to builder</Button>
          </Link>
        </div>
      </section>

      {responses.length === 0 ? (
        <EmptyState
          eyebrow="No submissions yet"
          title="Publish the form to start collecting responses."
          description="Only published forms are available on the public route, and every respondent stays anonymous on submission."
          action={
            <Link href={`/forms/${form.id}/edit`}>
              <Button>Open builder</Button>
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
                    <h2 className="font-display text-2xl text-[var(--ink)]">Submission #{response.submissionNumber} · {formatDate(response.submittedAt)}</h2>
                    <p className="text-sm text-[var(--muted)]">{response.answerCount} answers</p>
                  </div>
                </div>
                <div className="sm:flex sm:justify-end">
                  <Link href={`/forms/${form.id}/responses/${response.id}`}>
                    <Button size="sm" variant="secondary">
                      Open
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
