import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  metadataClassName?: string;
  actionsClassName?: string;
};

export function PageHeader({
  title,
  description,
  metadata,
  actions,
  as = "h1",
  className,
  titleClassName,
  descriptionClassName,
  metadataClassName,
  actionsClassName,
}: PageHeaderProps) {
  const Title = as;

  return (
    <section
      className={cn(
        "flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div>
        <Title
          className={cn(
            "font-display text-4xl text-[var(--ink)]",
            titleClassName,
          )}
        >
          {title}
        </Title>
        {metadata ? (
          <p
            className={cn(
              "mt-2 text-sm text-[var(--muted)]",
              metadataClassName,
            )}
          >
            {metadata}
          </p>
        ) : null}
        {description ? (
          <div
            className={cn(
              metadata ? "mt-2" : "mt-3",
              "max-w-3xl text-sm leading-6 text-[var(--muted)]",
              descriptionClassName,
            )}
          >
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div
          className={cn(
            "flex flex-wrap gap-3 lg:justify-end",
            actionsClassName,
          )}
        >
          {actions}
        </div>
      ) : null}
    </section>
  );
}
