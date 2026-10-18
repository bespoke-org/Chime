import { describe, expect, test } from "bun:test";

import { AppError } from "@/lib/errors";
import {
  assertSubmissionRateAllowed,
  createSubmissionRateLimiters,
  getSubmissionGuardConfig,
  isSubmissionTrapped,
} from "@/lib/submission-guard";

function statusOf(callback: () => void) {
  try {
    callback();
    return null;
  } catch (error) {
    return error instanceof AppError ? error.status : -1;
  }
}

describe("isSubmissionTrapped", () => {
  const now = 1_700_000_000_000;

  test("accepts an empty honeypot with a plausible fill time", () => {
    expect(
      isSubmissionTrapped({
        honeypot: "",
        startedAt: now - 10_000,
        now,
        minFillMs: 3000,
      }),
    ).toBe(false);
  });

  test("traps any non-empty honeypot, including whitespace-padded and non-string values", () => {
    for (const honeypot of ["x", "  http://spam  ", 1, {}, [], true]) {
      expect(
        isSubmissionTrapped({ honeypot, startedAt: now - 10_000, now }),
      ).toBe(true);
    }
  });

  test("treats whitespace-only honeypot as empty", () => {
    expect(
      isSubmissionTrapped({ honeypot: "   ", startedAt: now - 10_000, now }),
    ).toBe(false);
  });

  test("traps submissions faster than the minimum fill time", () => {
    expect(
      isSubmissionTrapped({
        honeypot: "",
        startedAt: now - 2999,
        now,
        minFillMs: 3000,
      }),
    ).toBe(true);
    expect(
      isSubmissionTrapped({
        honeypot: "",
        startedAt: now - 3000,
        now,
        minFillMs: 3000,
      }),
    ).toBe(false);
  });

  test("does not trap when startedAt is missing or malformed", () => {
    for (const startedAt of [undefined, null, "", "soon", Number.NaN, {}]) {
      expect(isSubmissionTrapped({ honeypot: "", startedAt, now })).toBe(false);
    }
  });

  test("does not trap a startedAt in the future (client clock ahead)", () => {
    expect(
      isSubmissionTrapped({
        honeypot: "",
        startedAt: now + 60_000,
        now,
        minFillMs: 3000,
      }),
    ).toBe(false);
  });

  test("accepts startedAt sent as a numeric string", () => {
    expect(
      isSubmissionTrapped({
        honeypot: "",
        startedAt: String(now - 1000),
        now,
        minFillMs: 3000,
      }),
    ).toBe(true);
  });
});

describe("assertSubmissionRateAllowed", () => {
  const config = {
    perFormLimit: 2,
    perIpLimit: 3,
    windowMs: 60_000,
    minFillMs: 3000,
  };

  test("limits per form and client IP", () => {
    const limiters = createSubmissionRateLimiters(config, () => 0);

    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f1", "ip")),
    ).toBe(null);
    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f1", "ip")),
    ).toBe(null);
    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f1", "ip")),
    ).toBe(429);
  });

  test("a different form or IP has its own per-form budget", () => {
    const limiters = createSubmissionRateLimiters(config, () => 0);

    assertSubmissionRateAllowed(limiters, "f1", "ip");
    assertSubmissionRateAllowed(limiters, "f1", "ip");
    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f2", "ip")),
    ).toBe(null);
    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f1", "other")),
    ).toBe(null);
  });

  test("the global per-IP cap applies across forms", () => {
    const limiters = createSubmissionRateLimiters(config, () => 0);

    assertSubmissionRateAllowed(limiters, "f1", "ip");
    assertSubmissionRateAllowed(limiters, "f2", "ip");
    assertSubmissionRateAllowed(limiters, "f3", "ip");
    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f4", "ip")),
    ).toBe(429);
  });

  test("a rejected per-form hit still consumes the global budget", () => {
    const limiters = createSubmissionRateLimiters(config, () => 0);

    assertSubmissionRateAllowed(limiters, "f1", "ip");
    assertSubmissionRateAllowed(limiters, "f1", "ip");
    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f1", "ip")),
    ).toBe(429);
    expect(
      statusOf(() => assertSubmissionRateAllowed(limiters, "f2", "ip")),
    ).toBe(429);
  });
});

describe("getSubmissionGuardConfig", () => {
  test("uses defaults when the environment is empty", () => {
    const config = getSubmissionGuardConfig({});

    expect(config.perFormLimit).toBe(5);
    expect(config.perIpLimit).toBe(30);
    expect(config.windowMs).toBe(600_000);
    expect(config.minFillMs).toBe(3000);
  });

  test("reads positive integers and ignores anything else", () => {
    const config = getSubmissionGuardConfig({
      SUBMISSION_RATE_LIMIT: " 7 ",
      SUBMISSION_GLOBAL_RATE_LIMIT: "0",
      SUBMISSION_RATE_WINDOW_SECONDS: "1.5",
      SUBMISSION_MIN_FILL_SECONDS: "abc",
    });

    expect(config.perFormLimit).toBe(7);
    expect(config.perIpLimit).toBe(30);
    expect(config.windowMs).toBe(600_000);
    expect(config.minFillMs).toBe(3000);
  });
});
