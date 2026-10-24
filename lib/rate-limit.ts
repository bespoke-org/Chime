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

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

// Number of reverse proxies in front of the app that append the address they
// saw to X-Forwarded-For. The client is that many entries from the right;
// everything left of it was sent by the client and can be anything.
export function getTrustedProxyHops(
  env: Record<string, string | undefined> = process.env,
) {
  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "", 10);

  return Number.isInteger(hops) && hops >= 0
    ? hops
    : DEFAULT_TRUSTED_PROXY_HOPS;
}

export function getClientIp(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
) {
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const hops = getTrustedProxyHops(env);

  if (forwarded.length && hops > 0) {
    // With fewer entries than hops the header was not filled by the proxies
    // alone; the leftmost entry is the closest we can get.
    return forwarded[Math.max(0, forwarded.length - hops)];
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}
