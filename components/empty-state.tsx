import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed px-8 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="mt-4 font-display text-3xl text-[var(--ink)]">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}
