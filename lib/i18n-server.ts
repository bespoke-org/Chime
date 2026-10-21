import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

import { getServerAuthSession } from "@/lib/auth";
import {
  resolveSessionLocale,
  translate,
  type AppLocale,
  type TranslationTree,
} from "@/lib/i18n";

const localeFileByKey: Record<AppLocale, string> = {
  en: "en.yml",
  ru: "ru.yml",
};

async function readMessages(locale: AppLocale): Promise<TranslationTree> {
  const filePath = path.join(process.cwd(), "locales", localeFileByKey[locale]);
  const file = await readFile(filePath, "utf8");
  return YAML.parse(file) as TranslationTree;
}

// The locale files only change with a deploy, so production parses each of
// them once per process. Development re-reads them on every request so an
// edited translation shows up without a restart.
const parsedMessages = new Map<AppLocale, Promise<TranslationTree>>();

export const getMessages = cache((locale: AppLocale) => {
  if (process.env.NODE_ENV !== "production") {
    return readMessages(locale);
  }

  let messages = parsedMessages.get(locale);

  if (!messages) {
    messages = readMessages(locale);
    parsedMessages.set(locale, messages);
  }

  return messages;
});

export async function resolveLocaleForUser(
  userLocale: AppLocale | null | undefined,
): Promise<AppLocale> {
  const headerStore = await headers();
  return resolveSessionLocale(userLocale, headerStore.get("accept-language"));
}

export async function getRequestLocale(): Promise<AppLocale> {
  const session = await getServerAuthSession();
  return resolveLocaleForUser(session?.user?.locale);
}

export async function getRequestI18n() {
  const locale = await getRequestLocale();
  const messages = await getMessages(locale);

  return {
    locale,
    messages,
    t: (key: string, values?: Record<string, string | number>) =>
      translate(messages, key, values),
  };
}
