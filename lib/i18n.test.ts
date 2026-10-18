import { describe, expect, test } from "bun:test";

import { resolveAppLocale, resolveSessionLocale } from "@/lib/i18n";

describe("resolveAppLocale", () => {
  test("uses the explicit override before request locale", () => {
    expect(resolveAppLocale("en", "ru")).toBe("ru");
  });

  test("falls back to the preferred locale when no override is set", () => {
    expect(resolveAppLocale("ru", null)).toBe("ru");
  });

  test("falls back to English for unsupported override values", () => {
    expect(resolveAppLocale("ru", "de")).toBe("en");
  });
});

describe("resolveSessionLocale", () => {
  test("keeps the user's explicit choice over the browser header", () => {
    expect(resolveSessionLocale("ru", "en-US,en;q=0.9")).toBe("ru");
  });

  test("normalizes a regional user locale", () => {
    expect(resolveSessionLocale("ru-RU", "en")).toBe("ru");
  });

  test("follows the browser when the user has no choice", () => {
    expect(resolveSessionLocale(null, "ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
  });

  test("falls back to English for an unsupported browser language", () => {
    expect(resolveSessionLocale(null, "de-DE,de;q=0.9")).toBe("en");
  });

  test("falls back to English without a browser header", () => {
    expect(resolveSessionLocale(null, null)).toBe("en");
  });
});
