"use client";

import { useEffect } from "react";

import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from "@/lib/i18n";

const errorMessages: Record<
  AppLocale,
  {
    eyebrow: string;
    title: string;
    description: string;
    tryAgain: string;
    footer: {
      poweredBy: string;
      appName: string;
      licensedUnder: string;
      sourceCode: string;
      reportBug: string;
    };
  }
> = {
  en: {
    eyebrow: "Something broke",
    title: "The forms hit an unexpected error.",
    description:
      "Try the action again. If it keeps happening, check your environment variables, ATProto OAuth setup, and local Postgres container.",
    tryAgain: "Try again",
    footer: {
      poweredBy: "Built with",
      appName: "Lively Forms",
      licensedUnder: "Licensed under",
      sourceCode: "Source code",
      reportBug: "Report a bug",
    },
  },
  ru: {
    eyebrow: "Что-то сломалось",
    title: "В формах произошла непредвиденная ошибка.",
    description:
      "Попробуйте выполнить действие ещё раз. Если это повторяется, проверьте переменные окружения, настройку ATProto OAuth и локальный контейнер Postgres.",
    tryAgain: "Попробовать снова",
    footer: {
      poweredBy: "Сделано с помощью",
      appName: "Живые формы",
      licensedUnder: "Лицензия",
      sourceCode: "Исходный код",
      reportBug: "Сообщить об ошибке",
    },
  },
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale: AppLocale =
    typeof window === "undefined"
      ? DEFAULT_LOCALE
      : normalizeLocale(window.navigator.language);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = errorMessages[locale];

  return (
    <html lang={locale}>
      <body>
        <div className="flex min-h-screen flex-col">
          <main className="mx-auto flex max-w-3xl flex-1 items-center px-6 py-16">
            <Card className="w-full px-8 py-10 text-center">
              <h1 className="font-display text-4xl text-[var(--ink)]">
                {copy.title}
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
                {copy.description}
              </p>
              <div className="mt-6 flex justify-center">
                <Button onClick={() => reset()}>{copy.tryAgain}</Button>
              </div>
            </Card>
          </main>
          <SiteFooter copy={copy.footer} />
        </div>
      </body>
    </html>
  );
}
