import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function NotFound() {
  const { t } = await getRequestI18n();
  return (
    <main className="mx-auto flex max-w-3xl flex-1 items-center px-6 py-16">
      <Card className="w-full px-8 py-10 text-center">
        <h1 className="font-display text-4xl text-[var(--ink)]">{t("notFound.title")}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
          {t("notFound.description")}
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/">
            <Button>{t("notFound.backHome")}</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
