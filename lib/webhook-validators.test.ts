import { describe, expect, test } from "bun:test";

import { webhookInputSchema } from "@/lib/webhook-validators";

const url = "https://hooks.example.com/chime";

function parse(input: Record<string, unknown>) {
  return webhookInputSchema.parse({ url, ...input });
}

function throws(run: () => unknown) {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

describe("webhookInputSchema", () => {
  test("defaults to an enabled immediate webhook without a secret", () => {
    expect(JSON.stringify(parse({ secret: "  " }))).toBe(
      JSON.stringify({
        url,
        secret: null,
        enabled: true,
        mode: "IMMEDIATE",
        digestInterval: null,
        digestTime: null,
        digestWeekday: null,
      }),
    );
  });

  test("rejects empty, private and too long URLs", () => {
    expect(throws(() => parse({ url: "" }))).toBe(true);
    expect(throws(() => parse({ url: "http://localhost/hook" }))).toBe(true);
    expect(throws(() => parse({ url: "http://10.0.0.5/hook" }))).toBe(true);
    expect(throws(() => parse({ url: "ftp://example.com/hook" }))).toBe(true);
    expect(
      throws(() => parse({ url: `https://example.com/${"a".repeat(2048)}` })),
    ).toBe(true);
  });

  test("limits the secret to 200 characters", () => {
    expect(parse({ secret: "x".repeat(200) }).secret).toBe("x".repeat(200));
    expect(throws(() => parse({ secret: "x".repeat(201) }))).toBe(true);
  });

  test("immediate mode clears schedule fields", () => {
    const parsed = parse({
      mode: "IMMEDIATE",
      digestInterval: "DAILY",
      digestTime: "09:00",
      digestWeekday: 2,
    });

    expect(parsed.digestInterval).toBe(null);
    expect(parsed.digestTime).toBe(null);
    expect(parsed.digestWeekday).toBe(null);
  });

  test("digest mode requires an interval", () => {
    expect(throws(() => parse({ mode: "DIGEST" }))).toBe(true);
    expect(
      parse({ mode: "DIGEST", digestInterval: "HOURLY" }).digestInterval,
    ).toBe("HOURLY");
  });

  test("hourly ignores time and weekday", () => {
    const parsed = parse({
      mode: "DIGEST",
      digestInterval: "HOURLY",
      digestTime: "09:00",
      digestWeekday: 4,
    });

    expect(parsed.digestTime).toBe(null);
    expect(parsed.digestWeekday).toBe(null);
  });

  test("daily requires a valid time and drops the weekday", () => {
    expect(
      throws(() => parse({ mode: "DIGEST", digestInterval: "DAILY" })),
    ).toBe(true);
    expect(
      throws(() =>
        parse({ mode: "DIGEST", digestInterval: "DAILY", digestTime: "24:00" }),
      ),
    ).toBe(true);
    expect(
      throws(() =>
        parse({ mode: "DIGEST", digestInterval: "DAILY", digestTime: "9:00" }),
      ),
    ).toBe(true);

    const parsed = parse({
      mode: "DIGEST",
      digestInterval: "DAILY",
      digestTime: "23:59",
      digestWeekday: 3,
    });
    expect(parsed.digestTime).toBe("23:59");
    expect(parsed.digestWeekday).toBe(null);
  });

  test("weekly requires a weekday between 0 and 6", () => {
    const weekly = {
      mode: "DIGEST",
      digestInterval: "WEEKLY",
      digestTime: "08:00",
    };

    expect(throws(() => parse(weekly))).toBe(true);
    expect(throws(() => parse({ ...weekly, digestWeekday: 7 }))).toBe(true);
    expect(throws(() => parse({ ...weekly, digestWeekday: -1 }))).toBe(true);
    expect(throws(() => parse({ ...weekly, digestWeekday: 1.5 }))).toBe(true);
    expect(parse({ ...weekly, digestWeekday: 0 }).digestWeekday).toBe(0);
    expect(parse({ ...weekly, digestWeekday: 6 }).digestWeekday).toBe(6);
  });
});
