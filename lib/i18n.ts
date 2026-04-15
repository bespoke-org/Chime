import type { ReactNode } from "react";

export const supportedLocales = ["en", "ru"] as const;
export type AppLocale = (typeof supportedLocales)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export type TranslationTree = {
  [key: string]: string | TranslationTree;
};

export function isSupportedLocale(
  value: string | null | undefined,
): value is AppLocale {
  return Boolean(value && supportedLocales.includes(value as AppLocale));
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  const normalized = value?.trim().toLowerCase().replace("_", "-") ?? "";
  const base = normalized.split("-")[0] ?? "";
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}

export function resolveAppLocale(
  preferredLocale: string | null | undefined,
  overrideLocale?: string | null,
): AppLocale {
  if (typeof overrideLocale !== "undefined" && overrideLocale !== null) {
    return normalizeLocale(overrideLocale);
  }

  return normalizeLocale(preferredLocale);
}

export function resolveBrowserLocale(
  headerValue: string | null | undefined,
): AppLocale {
  if (!headerValue) {
    return DEFAULT_LOCALE;
  }

  for (const rawPart of headerValue.split(",")) {
    const locale = rawPart.split(";")[0]?.trim() ?? "";
    const normalized = normalizeLocale(locale);

    if (
      isSupportedLocale(locale) ||
      isSupportedLocale(locale.split("-")[0] ?? "")
    ) {
      return normalized;
    }
  }

  return DEFAULT_LOCALE;
}

function getValue(messages: TranslationTree, key: string): string | null {
  let current: string | TranslationTree | undefined = messages;

  for (const part of key.split(".")) {
    if (!current || typeof current === "string" || !(part in current)) {
      return null;
    }

    current = current[part];
  }

  return typeof current === "string" ? current : null;
}

export function interpolateMessage(
  template: string,
  values?: Record<string, ReactNode | string | number>,
) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(.*?)\}/g, (_, key) =>
    String(values[key.trim()] ?? `{${key}}`),
  );
}

export function translate(
  messages: TranslationTree,
  key: string,
  values?: Record<string, ReactNode | string | number>,
) {
  const template = getValue(messages, key) ?? key;
  return interpolateMessage(template, values);
}

export function flattenTranslationTree(
  tree: TranslationTree,
  prefix = "",
): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const [key, value] of Object.entries(tree)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      entries[nextKey] = value;
      continue;
    }

    Object.assign(entries, flattenTranslationTree(value, nextKey));
  }

  return entries;
}
