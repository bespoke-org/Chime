import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

const localeFiles = {
  en: "en.yml",
  ru: "ru.yml",
};

function flatten(tree, prefix = "") {
  const entries = {};

  for (const [key, value] of Object.entries(tree ?? {})) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      entries[nextKey] = value;
      continue;
    }

    Object.assign(entries, flatten(value, nextKey));
  }

  return entries;
}

async function loadLocale(locale) {
  const filePath = path.join(process.cwd(), "locales", localeFiles[locale]);
  const file = await readFile(filePath, "utf8");
  return YAML.parse(file);
}

const defaultLabels = flatten(await loadLocale("en"));
let warningCount = 0;

for (const locale of Object.keys(localeFiles)) {
  if (locale === "en") continue;

  const labels = flatten(await loadLocale(locale));
  const missing = Object.keys(defaultLabels).filter((key) => !(key in labels));

  if (missing.length === 0) continue;

  warningCount += missing.length;
  console.warn(`\n[i18n] Missing translations for locale '${locale}':`);
  for (const key of missing) {
    console.warn(`- ${key}`);
  }
}

if (warningCount === 0) {
  console.log("[i18n] Translation validation passed.");
}
