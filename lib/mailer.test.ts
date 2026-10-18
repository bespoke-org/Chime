import { describe, expect, test } from "bun:test";

import { getMailerConfig } from "@/lib/mailer";

describe("getMailerConfig", () => {
  test("is not configured without MAIL_FROM", () => {
    expect(
      getMailerConfig({ SMTP_URL: "smtp://user:pass@smtp.example.com:587" }),
    ).toBe(null);
    expect(
      getMailerConfig({ MAIL_FROM: "   ", SMTP_HOST: "smtp.example.com" }),
    ).toBe(null);
  });

  test("is not configured without a URL or a host", () => {
    expect(
      getMailerConfig({ MAIL_FROM: "forms@example.com", SMTP_PORT: "587" }),
    ).toBe(null);
  });

  test("uses SMTP_URL as the transport when present", () => {
    const config = getMailerConfig({
      MAIL_FROM: " Lively Forms <forms@example.com> ",
      SMTP_URL: " smtp://user:pass@smtp.example.com:587 ",
      SMTP_HOST: "ignored.example.com",
    });

    expect(JSON.stringify(config)).toBe(
      JSON.stringify({
        from: "Lively Forms <forms@example.com>",
        transport: "smtp://user:pass@smtp.example.com:587",
      }),
    );
  });

  test("builds the split form with auth and an explicit port", () => {
    const config = getMailerConfig({
      MAIL_FROM: "forms@example.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "2525",
      SMTP_USER: "user",
      SMTP_PASSWORD: "p@ss word",
      SMTP_SECURE: "false",
    });

    expect(JSON.stringify(config)).toBe(
      JSON.stringify({
        from: "forms@example.com",
        transport: {
          host: "smtp.example.com",
          port: 2525,
          secure: false,
          auth: { user: "user", pass: "p@ss word" },
        },
      }),
    );
  });

  test("omits auth when SMTP_USER is empty", () => {
    const config = getMailerConfig({
      MAIL_FROM: "forms@example.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PASSWORD: "unused",
    });

    expect(JSON.stringify(config?.transport)).toBe(
      JSON.stringify({ host: "smtp.example.com", port: 587, secure: false }),
    );
  });

  test("reads SMTP_SECURE as true for true and 1 only", () => {
    const secureOf = (value: string) => {
      const config = getMailerConfig({
        MAIL_FROM: "forms@example.com",
        SMTP_HOST: "smtp.example.com",
        SMTP_SECURE: value,
      });
      return typeof config?.transport === "object"
        ? config.transport.secure
        : null;
    };

    expect(secureOf("true")).toBe(true);
    expect(secureOf(" TRUE ")).toBe(true);
    expect(secureOf("1")).toBe(true);
    expect(secureOf("false")).toBe(false);
    expect(secureOf("0")).toBe(false);
    expect(secureOf("yes")).toBe(false);
  });

  test("falls back to the default port for the secure flag when SMTP_PORT is not numeric", () => {
    const portOf = (port: string | undefined, secure: string | undefined) => {
      const config = getMailerConfig({
        MAIL_FROM: "forms@example.com",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: port,
        SMTP_SECURE: secure,
      });
      return typeof config?.transport === "object"
        ? config.transport.port
        : null;
    };

    expect(portOf("abc", "true")).toBe(465);
    expect(portOf("abc", undefined)).toBe(587);
    expect(portOf("", "1")).toBe(465);
    expect(portOf("-25", undefined)).toBe(587);
    expect(portOf("25.5", undefined)).toBe(587);
    expect(portOf("25", "true")).toBe(25);
  });
});
