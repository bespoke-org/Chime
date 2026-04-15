import { describe, expect, test } from "bun:test";

import { formMetadataSchema } from "@/lib/validators";

describe("formMetadataSchema", () => {
  test("keeps a supported respondent locale override", () => {
    const parsed = formMetadataSchema.parse({
      title: "Demo form",
      slug: "demo-form",
      respondentLocale: "ru",
    });

    expect(parsed.respondentLocale).toBe("ru");
  });

  test("defaults respondent locale to visitor language mode", () => {
    const parsed = formMetadataSchema.parse({
      title: "Demo form",
      slug: "demo-form",
    });

    expect(parsed.respondentLocale).toBe(null);
  });

  test("defaults allowBackNavigation to true", () => {
    const parsed = formMetadataSchema.parse({
      title: "Demo form",
      slug: "demo-form",
    });

    expect(parsed.allowBackNavigation).toBe(true);
  });

  test("preserves an explicit disabled allowBackNavigation value", () => {
    const parsed = formMetadataSchema.parse({
      title: "Demo form",
      slug: "demo-form",
      allowBackNavigation: false,
    });

    expect(parsed.allowBackNavigation).toBe(false);
  });
});
