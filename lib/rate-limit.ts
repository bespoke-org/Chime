export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type SlidingWindowRateLimiterOptions = {
  limit: number;
  windowMs: number;
  now?: () => number;
  pruneEvery?: number;
};

// Keeps the hit timestamps per key in process memory. Good enough for a single
// Node process behind one reverse proxy; a multi-node deployment would need a
// shared store instead.
export class SlidingWindowRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly pruneEvery: number;
  private readonly hits = new Map<string, number[]>();
  private hitsSincePrune = 0;

  constructor(options: SlidingWindowRateLimiterOptions) {
    this.limit = Math.max(1, Math.floor(options.limit));
    this.windowMs = Math.max(1, Math.floor(options.windowMs));
    this.now = options.now ?? Date.now;
    this.pruneEvery = Math.max(1, Math.floor(options.pruneEvery ?? 1000));
  }

  hit(key: string): RateLimitDecision {
    const now = this.now();
    const windowStart = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      this.maybePrune(now);

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: recent[0] + this.windowMs - now,
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    this.maybePrune(now);

    return {
      allowed: true,
      remaining: this.limit - recent.length,
      retryAfterMs: 0,
    };
  }

  prune(now = this.now()) {
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.hits) {
      const recent = timestamps.filter((timestamp) => timestamp > windowStart);

      if (recent.length) {
        this.hits.set(key, recent);
      } else {
        this.hits.delete(key);
      }
    }
  }

  get size() {
    return this.hits.size;
  }

  private maybePrune(now: number) {
    this.hitsSincePrune += 1;

    if (this.hitsSincePrune >= this.pruneEvery) {
      this.hitsSincePrune = 0;
      this.prune(now);
    }
  }
}

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();

  if (firstForwarded) {
    return firstForwarded;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}
