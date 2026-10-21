import type { FormStatus } from "@prisma/client";

import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FormStatusBadge({
  status,
  closed = false,
  className,
}: {
  status: FormStatus;
  closed?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const isClosed = status === "PUBLISHED" && closed;

  return (
    <Badge
      className={cn(
        status === "PUBLISHED" &&
          !isClosed &&
          "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
        className,
      )}
    >
      {isClosed ? t("statuses.closed") : t(`statuses.${status.toLowerCase()}`)}
    </Badge>
  );
}
