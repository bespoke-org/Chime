import type { FormStatus } from "@prisma/client";

import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FormStatusBadge({
  status,
  className,
}: {
  status: FormStatus;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <Badge
      className={cn(
        "rounded-full",
        status === "PUBLISHED" &&
          "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
        className,
      )}
    >
      {t(`statuses.${status.toLowerCase()}`)}
    </Badge>
  );
}
