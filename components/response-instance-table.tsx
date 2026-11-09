import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { AuthoredMarkdown } from "@/components/ui/authored-markdown";
import type { AnswerValue, StoredAnswerValue } from "@/lib/form-types";
import {
  resolveStoredAnswerView,
  type ResponseDetailSection,
} from "@/lib/response-review";

export function ResponseInstanceTable({
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
  const columns = section.blocks
    .filter((block) => block.type !== "TEXT")
    .map((block) => ({
      block,
      view: resolveStoredAnswerView(block, answers[block.id]),
    }));

  if (!columns.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="block w-full text-left md:table">
          <caption className="block px-5 py-4 text-left text-base font-semibold text-[var(--ink)] md:table-caption">
            {section.name || title}
          </caption>
          <thead className="hidden border-y border-[var(--line)] bg-[var(--surface)] md:table-header-group">
            <tr>
              <th scope="col" className="w-12 px-5 py-3 text-sm font-medium">
                <span aria-hidden="true">№</span>
                <span className="sr-only">{title}</span>
              </th>
              {columns.map(({ block }) => (
                <th
                  key={block.id}
                  scope="col"
                  className="min-w-40 px-5 py-3 align-top text-sm font-medium text-[var(--muted)]"
                >
                  {block.title}
                  {block.description ? (
                    <AuthoredMarkdown
                      content={block.description}
                      className="mt-1 text-xs font-normal"
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block divide-y divide-[var(--line)] md:table-row-group">
            {Array.from({ length: section.instanceCount }, (_, index) => (
              <tr key={index} className="block px-5 py-4 md:table-row md:p-0">
                <th
                  scope="row"
                  className="mb-3 block text-sm font-medium text-[var(--muted)] md:table-cell md:px-5 md:py-3 md:align-top"
                >
                  <span className="md:hidden">{instanceLabel(index + 1)}</span>
                  <span className="hidden md:inline">{index + 1}</span>
                </th>
                {columns.map(({ block, view }) => (
                  <td
                    key={block.id}
                    className="mt-3 block min-w-0 text-[var(--ink)] [overflow-wrap:anywhere] md:table-cell md:max-w-sm md:px-5 md:py-3 md:align-top"
                  >
                    <div className="mb-1 text-sm text-[var(--muted)] md:hidden">
                      {block.title}
                      {block.description ? (
                        <AuthoredMarkdown
                          content={block.description}
                          className="mt-1 text-xs"
                        />
                      ) : null}
                    </div>
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
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!section.instanceCount ? (
        <p className="px-5 pb-4 text-sm text-[var(--muted)]">{noAnswer}</p>
      ) : null}
    </Card>
  );
}
