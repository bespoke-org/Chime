import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="px-8 py-8">
      <h3 className="text-lg font-semibold text-[var(--ink)]">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex">{action}</div> : null}
    </Card>
  );
}
