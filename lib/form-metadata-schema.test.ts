import { describe, expect, test } from "bun:test";

import { slugify } from "@/lib/utils";
import {
  formMetadataSchema,
  profileSettingsSchema,
  reorderBlocksSchema,
} from "@/lib/validators";

function throws(fn: () => unknown) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function metadata(overrides: Record<string, unknown>) {
  return formMetadataSchema.parse({
    title: "Demo form",
    slug: "demo-form",
    ...overrides,
  });
}

describe("formMetadataSchema slug", () => {
  test("rejects slugs that are not lowercase kebab-case", () => {
    for (const slug of [
      "Demo-Form",
      "demo form",
      "демо",
      "-demo",
      "demo-",
      "demo--form",
      "demo_form",
      "a",
      "x".repeat(65),
    ]) {
      expect(throws(() => metadata({ slug }))).toBe(true);
    }
  });

  test("accepts digits-only and two-character slugs", () => {
    expect(metadata({ slug: "42" }).slug).toBe("42");
    expect(metadata({ slug: "ab" }).slug).toBe("ab");
  });

  test("trims surrounding whitespace before validating", () => {
    expect(metadata({ slug: "  demo-form  " }).slug).toBe("demo-form");
  });
});

describe("formMetadataSchema completion link", () => {
  test("requires label and url together", () => {
    expect(throws(() => metadata({ completionLinkLabel: "Go" }))).toBe(true);
    expect(
      throws(() => metadata({ completionLinkUrl: "https://example.com" })),
    ).toBe(true);
  });

  test("rejects non-http schemes and malformed urls", () => {
    for (const url of [
      "javascript:alert(1)",
      "ftp://x.y",
      "example.com",
      "x",
    ]) {
      expect(
        throws(() =>
          metadata({ completionLinkLabel: "Go", completionLinkUrl: url }),
        ),
      ).toBe(true);
    }
  });

  test("stores empty label and url as null", () => {
    const parsed = metadata({
      completionLinkLabel: "  ",
      completionLinkUrl: "",
    });

    expect(parsed.completionLinkLabel).toBe(null);
    expect(parsed.completionLinkUrl).toBe(null);
  });

  test("keeps a valid pair", () => {
    const parsed = metadata({
      completionLinkLabel: " Go ",
      completionLinkUrl: " https://example.com/thanks ",
    });

    expect(parsed.completionLinkLabel).toBe("Go");
    expect(parsed.completionLinkUrl).toBe("https://example.com/thanks");
  });
});

describe("formMetadataSchema fields", () => {
  test("rejects an unsupported respondent locale", () => {
    expect(throws(() => metadata({ respondentLocale: "de" }))).toBe(true);
    expect(throws(() => metadata({ respondentLocale: "" }))).toBe(true);
  });

  test("rejects an empty or whitespace-only title", () => {
    expect(throws(() => metadata({ title: "   " }))).toBe(true);
    expect(throws(() => metadata({ title: "x".repeat(121) }))).toBe(true);
  });

  test("rejects non-boolean toggles", () => {
    expect(throws(() => metadata({ showProgress: "yes" }))).toBe(true);
    expect(throws(() => metadata({ allowBackNavigation: 1 }))).toBe(true);
  });
});

describe("formMetadataSchema webhook", () => {
  test("stores empty or missing webhook fields as null", () => {
    expect(metadata({}).webhookUrl).toBe(null);
    expect(metadata({}).webhookSecret).toBe(null);
    expect(metadata({ webhookUrl: "  ", webhookSecret: "" }).webhookUrl).toBe(
      null,
    );
    expect(
      metadata({ webhookUrl: "  ", webhookSecret: "" }).webhookSecret,
    ).toBe(null);
  });

  test("trims and keeps a public webhook URL and secret", () => {
    const parsed = metadata({
      webhookUrl: " https://hooks.example.com/lively ",
      webhookSecret: " s3cret ",
    });

    expect(parsed.webhookUrl).toBe("https://hooks.example.com/lively");
    expect(parsed.webhookSecret).toBe("s3cret");
  });

  test("rejects invalid, private, and too long webhook URLs", () => {
    for (const webhookUrl of [
      "ftp://example.com/hook",
      "example.com/hook",
      "http://localhost:3000/hook",
      "http://127.0.0.1/hook",
      "http://192.168.0.10/hook",
      "https://service.internal/hook",
      `https://example.com/${"x".repeat(2048)}`,
    ]) {
      expect(throws(() => metadata({ webhookUrl }))).toBe(true);
    }
  });

  test("rejects a secret over two hundred characters", () => {
    expect(throws(() => metadata({ webhookSecret: "x".repeat(201) }))).toBe(
      true,
    );
    expect(metadata({ webhookSecret: "x".repeat(200) }).webhookSecret).toBe(
      "x".repeat(200),
    );
  });
});

describe("reorderBlocksSchema", () => {
  test("rejects an empty list", () => {
    expect(throws(() => reorderBlocksSchema.parse({ blockIds: [] }))).toBe(
      true,
    );
  });

  test("rejects duplicate ids", () => {
    expect(
      throws(() => reorderBlocksSchema.parse({ blockIds: ["a", "b", "a"] })),
    ).toBe(true);
  });

  test("rejects non-string ids", () => {
    expect(
      throws(() => reorderBlocksSchema.parse({ blockIds: ["a", 1] })),
    ).toBe(true);
  });
});

describe("profileSettingsSchema", () => {
  test("trims names and stores empty ones as null", () => {
    const parsed = profileSettingsSchema.parse({
      firstName: "  Ada ",
      secondName: "   ",
    });

    expect(parsed.firstName).toBe("Ada");
    expect(parsed.secondName).toBe(null);
    expect(parsed.locale).toBe("en");
    expect(parsed.image).toBe(null);
  });

  test("rejects names over sixty characters after trimming", () => {
    expect(
      throws(() => profileSettingsSchema.parse({ firstName: "x".repeat(61) })),
    ).toBe(true);
    expect(
      profileSettingsSchema.parse({ firstName: ` ${"x".repeat(60)} ` })
        .firstName,
    ).toBe("x".repeat(60));
  });

  test("rejects unsupported locales", () => {
    expect(throws(() => profileSettingsSchema.parse({ locale: "de" }))).toBe(
      true,
    );
  });

  test("accepts only http and https image urls", () => {
    expect(
      profileSettingsSchema.parse({ image: " https://cdn.example/a.png " })
        .image,
    ).toBe("https://cdn.example/a.png");
    for (const image of [
      "data:image/png;base64,AAAA",
      "ftp://x/y.png",
      "a.png",
    ]) {
      expect(throws(() => profileSettingsSchema.parse({ image }))).toBe(true);
    }
  });
});

describe("slugify", () => {
  test("lowercases and replaces runs of other characters with one dash", () => {
    expect(slugify("  Hello,  World! 2026 ")).toBe("hello-world-2026");
  });

  test("returns an empty string for non-latin input", () => {
    expect(slugify("Форма без названия")).toBe("");
  });

  test("never ends with a dash after truncation", () => {
    const slug = slugify(`${"a".repeat(47)} ${"b".repeat(10)}`);

    expect(slug.length <= 48).toBe(true);
    expect(slug.endsWith("-")).toBe(false);
    expect(throws(() => metadata({ slug }))).toBe(false);
  });
});

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
