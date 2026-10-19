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

describe("formMetadataSchema webhooks", () => {
  test("defaults to no webhooks and drops cards without a URL", () => {
    expect(metadata({}).webhooks.length).toBe(0);
    expect(
      metadata({ webhooks: [{ url: "  ", secret: "s3cret" }] }).webhooks.length,
    ).toBe(0);
  });

  test("trims each URL and secret, keeps order, stores an empty secret as null", () => {
    const parsed = metadata({
      webhooks: [
        { url: " https://hooks.example.com/one ", secret: " s3cret " },
        { url: "https://hooks.example.com/two", secret: "" },
      ],
    });

    expect(JSON.stringify(parsed.webhooks)).toBe(
      JSON.stringify([
        { url: "https://hooks.example.com/one", secret: "s3cret" },
        { url: "https://hooks.example.com/two", secret: null },
      ]),
    );
  });

  test("rejects invalid, private, and too long webhook URLs", () => {
    for (const url of [
      "ftp://example.com/hook",
      "example.com/hook",
      "http://localhost:3000/hook",
      "http://127.0.0.1/hook",
      "http://192.168.0.10/hook",
      "https://service.internal/hook",
      `https://example.com/${"x".repeat(2048)}`,
    ]) {
      expect(
        throws(() =>
          metadata({
            webhooks: [{ url: "https://hooks.example.com/ok" }, { url }],
          }),
        ),
      ).toBe(true);
    }
  });

  test("rejects a secret over two hundred characters", () => {
    const url = "https://hooks.example.com/lively";

    expect(
      throws(() => metadata({ webhooks: [{ url, secret: "x".repeat(201) }] })),
    ).toBe(true);
    expect(
      metadata({ webhooks: [{ url, secret: "x".repeat(200) }] }).webhooks[0]
        ?.secret,
    ).toBe("x".repeat(200));
  });

  test("accepts ten webhooks and rejects eleven", () => {
    const webhooks = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        url: `https://hooks.example.com/${index}`,
      }));

    expect(metadata({ webhooks: webhooks(10) }).webhooks.length).toBe(10);
    expect(throws(() => metadata({ webhooks: webhooks(11) }))).toBe(true);
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

  test("trims and lowercases the notification email", () => {
    expect(
      profileSettingsSchema.parse({ notificationEmail: "  Ada@Example.COM " })
        .notificationEmail,
    ).toBe("ada@example.com");
  });

  test("stores a missing or empty notification email as null", () => {
    expect(profileSettingsSchema.parse({}).notificationEmail).toBe(null);
    expect(
      profileSettingsSchema.parse({ notificationEmail: "   " })
        .notificationEmail,
    ).toBe(null);
    expect(
      profileSettingsSchema.parse({ notificationEmail: null })
        .notificationEmail,
    ).toBe(null);
  });

  test("rejects notification emails that are malformed or too long", () => {
    expect(
      throws(() => profileSettingsSchema.parse({ notificationEmail: "nope" })),
    ).toBe(true);
    expect(
      throws(() =>
        profileSettingsSchema.parse({ notificationEmail: "ada@example" }),
      ),
    ).toBe(true);
    expect(
      throws(() =>
        profileSettingsSchema.parse({
          notificationEmail: `${"x".repeat(243)}@example.com`,
        }),
      ),
    ).toBe(true);
    expect(
      profileSettingsSchema.parse({
        notificationEmail: `${"x".repeat(242)}@example.com`,
      }).notificationEmail,
    ).toBe(`${"x".repeat(242)}@example.com`);
  });

  test("rejects a non-ASCII local part, following zod's email check", () => {
    expect(
      throws(() =>
        profileSettingsSchema.parse({ notificationEmail: "ада@example.com" }),
      ),
    ).toBe(true);
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

describe("formMetadataSchema closing", () => {
  test("defaults to no closing rules", () => {
    const parsed = metadata({});

    expect(parsed.closesAt).toBe(null);
    expect(parsed.maxResponses).toBe(null);
    expect(parsed.closedManually).toBe(false);
    expect(parsed.closedMessage).toBe("");
  });

  test("turns empty strings into null", () => {
    const parsed = metadata({ closesAt: "  ", maxResponses: "" });

    expect(parsed.closesAt).toBe(null);
    expect(parsed.maxResponses).toBe(null);
  });

  test("parses a valid ISO closing time into a Date, past dates included", () => {
    const future = metadata({ closesAt: "2030-01-01T10:00:00.000Z" }).closesAt;
    const past = metadata({ closesAt: "2000-01-01T10:00:00.000Z" }).closesAt;

    expect(future instanceof Date).toBe(true);
    expect(future?.toISOString()).toBe("2030-01-01T10:00:00.000Z");
    expect(past?.toISOString()).toBe("2000-01-01T10:00:00.000Z");
  });

  test("rejects an unparsable closing time", () => {
    expect(throws(() => metadata({ closesAt: "tomorrow" }))).toBe(true);
    expect(throws(() => metadata({ closesAt: "2030-13-45" }))).toBe(true);
  });

  test("accepts response caps between 1 and 1,000,000", () => {
    expect(metadata({ maxResponses: 1 }).maxResponses).toBe(1);
    expect(metadata({ maxResponses: 1_000_000 }).maxResponses).toBe(1_000_000);
  });

  test("rejects zero, negative, fractional, string, and oversized caps", () => {
    for (const maxResponses of [0, -1, 1.5, "10", 1_000_001]) {
      expect(throws(() => metadata({ maxResponses }))).toBe(true);
    }
  });

  test("trims the closed message and caps it at 1000 characters", () => {
    expect(metadata({ closedMessage: "  See you  " }).closedMessage).toBe(
      "See you",
    );
    expect(metadata({ closedMessage: "x".repeat(1000) }).closedMessage).toBe(
      "x".repeat(1000),
    );
    expect(throws(() => metadata({ closedMessage: "x".repeat(1001) }))).toBe(
      true,
    );
  });

  test("rejects a non-boolean closedManually value", () => {
    expect(throws(() => metadata({ closedManually: "true" }))).toBe(true);
    expect(throws(() => metadata({ closedManually: 1 }))).toBe(true);
    expect(metadata({ closedManually: true }).closedManually).toBe(true);
  });
});
