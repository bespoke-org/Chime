import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="px-8 py-8">
      <p className="text-xs font-semibold uppercase text-[var(--accent)]">{eyebrow}</p>
      <h3 className="mt-3 font-display text-2xl text-[var(--ink)]">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-5 flex">{action}</div> : null}
    </Card>
  );
}
