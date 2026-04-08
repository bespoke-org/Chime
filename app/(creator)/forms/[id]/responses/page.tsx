import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[30px] border border-black/8 bg-white/70 px-6 py-5 backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Responses</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">{form.title}</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Read each anonymous submission in form order and keep the conversational context intact.</p>
        </div>
        <div className="flex gap-3">
          <Badge>{responses.length} submissions</Badge>
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
        <div className="grid gap-4">
          {responses.map((response) => (
            <Card key={response.id} className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Anonymous response</p>
                  <h2 className="mt-3 font-display text-3xl text-[var(--ink)]">{formatDate(response.submittedAt)}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">{response.answerCount} answers captured</p>
                </div>
                <Link href={`/forms/${form.id}/responses/${response.id}`}>
                  <Button>
                    Open response
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
