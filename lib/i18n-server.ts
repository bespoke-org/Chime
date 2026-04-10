import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

import { getServerAuthSession } from "@/lib/auth";
import { DEFAULT_LOCALE, resolveBrowserLocale, translate, type AppLocale, type TranslationTree } from "@/lib/i18n";

const localeFileByKey: Record<AppLocale, string> = {
  en: "en.yml",
  ru: "ru.yml",
};

export const getMessages = cache(async (locale: AppLocale): Promise<TranslationTree> => {
  const filePath = path.join(process.cwd(), "locales", localeFileByKey[locale]);
  const file = await readFile(filePath, "utf8");
  return YAML.parse(file) as TranslationTree;
});

export async function getRequestLocale(): Promise<AppLocale> {
  const session = await getServerAuthSession();

  if (session?.user?.locale) {
    return session.user.locale;
  }

  const headerStore = await headers();
  return resolveBrowserLocale(headerStore.get("accept-language") ?? DEFAULT_LOCALE);
}

export async function getRequestI18n() {
  const locale = await getRequestLocale();
  const messages = await getMessages(locale);

  return {
    locale,
    messages,
    t: (key: string, values?: Record<string, string | number>) => translate(messages, key, values),
  };
}
