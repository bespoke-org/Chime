"use client";

import { createContext, useContext, useMemo } from "react";

import { translate, type AppLocale, type TranslationTree } from "@/lib/i18n";

type I18nContextValue = {
  locale: AppLocale;
  messages: TranslationTree;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: AppLocale;
  messages: TranslationTree;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, messages, t: (key: string, values?: Record<string, string | number>) => translate(messages, key, values) }),
    [locale, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return value;
}
