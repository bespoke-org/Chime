import { describe, expect, test } from "bun:test";

import { resolveAppLocale } from "@/lib/i18n";

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
