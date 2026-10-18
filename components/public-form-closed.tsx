"use client";

import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";

export function PublicFormClosed({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { t } = useI18n();
  const resolvedMessage =
    message.trim() || t("publicRunner.defaultClosedMessage");

  return (
    <Card className="w-full max-w-3xl overflow-hidden">
      <div className="border-b border-[color:var(--line)] bg-[var(--accent-soft)]/55 px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase text-[var(--accent)]">
          {t("publicRunner.formClosed")}
        </p>
      </div>
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        <h1 className="max-w-2xl font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">
          {resolvedMessage}
        </p>
      </div>
    </Card>
  );
}
