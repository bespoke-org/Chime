import { describe, expect, test } from "bun:test";

import { SlidingWindowRateLimiter, getClientIp } from "@/lib/rate-limit";

function createClock(start = 1_000_000) {
  let current = start;

  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe("SlidingWindowRateLimiter", () => {
  test("allows up to the limit and then blocks within the window", () => {
    const clock = createClock();
    const limiter = new SlidingWindowRateLimiter({
      limit: 3,
      windowMs: 1000,
      now: clock.now,
    });

    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(true);
    const third = limiter.hit("a");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = limiter.hit("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  test("blocked hits do not extend the window", () => {
    const clock = createClock();
    const limiter = new SlidingWindowRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.hit("a");
    clock.advance(600);
    expect(limiter.hit("a").allowed).toBe(false);
    clock.advance(401);
    expect(limiter.hit("a").allowed).toBe(true);
  });

  test("a hit expires exactly when the window length has passed", () => {
    const clock = createClock();
    const limiter = new SlidingWindowRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.hit("a");
    clock.advance(999);
    expect(limiter.hit("a").allowed).toBe(false);
    clock.advance(1);
    expect(limiter.hit("a").allowed).toBe(true);
  });

  test("slides: the oldest hit expiring frees exactly one slot", () => {
    const clock = createClock();
    const limiter = new SlidingWindowRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.hit("a");
    clock.advance(500);
    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);

    clock.advance(501);
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
  });

  test("keys are independent", () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000 });

    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("b").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
  });

  test("retryAfterMs reports time until the oldest hit leaves the window", () => {
    const clock = createClock();
    const limiter = new SlidingWindowRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.hit("a");
    clock.advance(250);
    expect(limiter.hit("a").retryAfterMs).toBe(750);
  });

  test("prune drops keys with no hits left in the window", () => {
    const clock = createClock();
    const limiter = new SlidingWindowRateLimiter({
      limit: 5,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.hit("old");
    clock.advance(500);
    limiter.hit("fresh");
    expect(limiter.size).toBe(2);

    clock.advance(501);
    limiter.prune();
    expect(limiter.size).toBe(1);

    clock.advance(500);
    limiter.prune();
    expect(limiter.size).toBe(0);
  });

  test("prunes automatically after the configured number of hits", () => {
    const clock = createClock();
    const limiter = new SlidingWindowRateLimiter({
      limit: 5,
      windowMs: 100,
      now: clock.now,
      pruneEvery: 3,
    });

    limiter.hit("a");
    limiter.hit("b");
    clock.advance(200);
    expect(limiter.size).toBe(2);
    limiter.hit("c");
    expect(limiter.size).toBe(1);
  });

  test("clamps non-positive or fractional options to sane values", () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 0.4, windowMs: 0 });

    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  test("takes the x-forwarded-for entry added by the trusted proxy", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.9 , 10.0.0.1",
      "x-real-ip": "10.0.0.2",
    });

    // One hop by default: the last entry was appended by the proxy, the
    // first one came from the client and could be forged.
    expect(getClientIp(headers, {})).toBe("10.0.0.1");
    expect(getClientIp(headers, { TRUSTED_PROXY_HOPS: "2" })).toBe(
      "203.0.113.9",
    );
  });

  test("falls back to the leftmost entry when there are fewer entries than hops", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9" });

    expect(getClientIp(headers, { TRUSTED_PROXY_HOPS: "3" })).toBe(
      "203.0.113.9",
    );
  });

  test("ignores x-forwarded-for with zero hops and bad values", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9",
      "x-real-ip": "10.0.0.2",
    });

    expect(getClientIp(headers, { TRUSTED_PROXY_HOPS: "0" })).toBe("10.0.0.2");
    expect(getClientIp(headers, { TRUSTED_PROXY_HOPS: "many" })).toBe(
      "203.0.113.9",
    );
    expect(getClientIp(headers, { TRUSTED_PROXY_HOPS: "-1" })).toBe(
      "203.0.113.9",
    );
  });

  test("falls back to x-real-ip and then to unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "10.0.0.2" }), {})).toBe(
      "10.0.0.2",
    );
    expect(getClientIp(new Headers({ "x-forwarded-for": " , " }), {})).toBe(
      "unknown",
    );
    expect(getClientIp(new Headers(), {})).toBe("unknown");
  });
});
