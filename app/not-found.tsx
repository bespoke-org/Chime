import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getRequestI18n } from "@/lib/i18n-server";
import { withTitle } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();
  return withTitle(t("meta.notFound"));
}

export default async function NotFound() {
  const { t } = await getRequestI18n();
  return (
    <main className="mx-auto flex max-w-3xl flex-1 items-center px-6 py-16">
      <div className="w-full">
        <h1 className="font-display text-4xl text-[var(--ink)]">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
          {t("notFound.description")}
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button>{t("notFound.backHome")}</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
