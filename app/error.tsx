"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from "@/lib/i18n";

const errorMessages: Record<AppLocale, { eyebrow: string; title: string; description: string; tryAgain: string }> = {
  en: {
    eyebrow: "Something broke",
    title: "The forms hit an unexpected error.",
    description: "Try the action again. If it keeps happening, check your environment variables, Google OAuth setup, and local Postgres container.",
    tryAgain: "Try again",
  },
  ru: {
    eyebrow: "Что-то сломалось",
    title: "В формах произошла непредвиденная ошибка.",
    description: "Попробуйте выполнить действие ещё раз. Если это повторяется, проверьте переменные окружения, настройку Google OAuth и локальный контейнер Postgres.",
    tryAgain: "Попробовать снова",
  },
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale: AppLocale = typeof window === "undefined" ? DEFAULT_LOCALE : normalizeLocale(window.navigator.language);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = errorMessages[locale];

  return (
    <html lang={locale}>
      <body>
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
          <Card className="w-full px-8 py-10 text-center">
            <h1 className="font-display text-4xl text-[var(--ink)]">{copy.title}</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">{copy.description}</p>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => reset()}>{copy.tryAgain}</Button>
            </div>
          </Card>
        </main>
      </body>
    </html>
  );
}
