import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { AuthoredMarkdown } from "@/components/ui/authored-markdown";
import type { AnswerValue, StoredAnswerValue } from "@/lib/form-types";
import {
  resolveStoredAnswerView,
  type ResponseDetailSection,
} from "@/lib/response-review";
import { cn } from "@/lib/utils";

export function ResponseInstanceCards({
  section,
  answers,
  title,
  instanceLabel,
  noAnswer,
  renderAnswer,
}: {
  section: Extract<ResponseDetailSection, { kind: "repeatedPage" }>;
  answers: Record<string, StoredAnswerValue>;
  title: string;
  instanceLabel: (number: number) => string;
  noAnswer: string;
  renderAnswer: (type: string, value: AnswerValue | undefined) => ReactNode;
}) {
  const fields = section.blocks
    .filter((block) => block.type !== "TEXT")
    .map((block) => ({
      block,
      view: resolveStoredAnswerView(block, answers[block.id]),
    }));

  if (!fields.length) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--ink)]">
        {section.name || title}
      </h2>
      {Array.from({ length: section.instanceCount }, (_, index) => (
        <article key={index} aria-label={instanceLabel(index + 1)}>
          <Card className="p-5 sm:p-6">
            <h3 className="mb-5 border-b border-[var(--line)] pb-3 text-base font-semibold text-[var(--ink)]">
              {instanceLabel(index + 1)}
            </h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              {fields.map(({ block, view }) => (
                <div
                  key={block.id}
                  className={cn(
                    "min-w-0 [overflow-wrap:anywhere]",
                    (block.type === "LONG_TEXT" ||
                      block.type === "MULTIPLE_CHOICE" ||
                      block.type === "FILE_UPLOAD") &&
                      "md:col-span-2",
                  )}
                >
                  <dt className="text-sm text-[var(--muted)]">
                    {block.title}
                    {block.description ? (
                      <AuthoredMarkdown
                        content={block.description}
                        className="mt-1 text-xs"
                      />
                    ) : null}
                  </dt>
                  <dd className="mt-1 text-[var(--ink)]">
                    {renderAnswer(
                      block.type,
                      view.kind === "instances"
                        ? view.entries.find(
                            (entry) => entry.instanceIndex === index,
                          )?.value
                        : index === 0
                          ? view.value
                          : undefined,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </article>
      ))}
      {!section.instanceCount ? (
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-[var(--muted)]">{noAnswer}</p>
        </Card>
      ) : null}
    </div>
  );
}
