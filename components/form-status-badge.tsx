import type { FormStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn, sentenceCase } from "@/lib/utils";

export function FormStatusBadge({ status, className }: { status: FormStatus; className?: string }) {
  return (
    <Badge
      className={cn(
        "rounded-full",
        status === "PUBLISHED" && "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
        className,
      )}
    >
      {sentenceCase(status)}
    </Badge>
  );
}
