import { AppError } from "@/lib/errors";
import { SlidingWindowRateLimiter } from "@/lib/rate-limit";

export const SUBMISSION_HONEYPOT_FIELD = "website";

export type SubmissionGuardConfig = {
  perFormLimit: number;
  perIpLimit: number;
  windowMs: number;
  minFillMs: number;
};

const DEFAULT_CONFIG: SubmissionGuardConfig = {
  perFormLimit: 5,
  perIpLimit: 30,
  windowMs: 10 * 60 * 1000,
  minFillMs: 3000,
};

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSubmissionGuardConfig(
  env: Record<string, string | undefined> = process.env,
): SubmissionGuardConfig {
  return {
    perFormLimit: readPositiveInteger(
      env.SUBMISSION_RATE_LIMIT,
      DEFAULT_CONFIG.perFormLimit,
    ),
    perIpLimit: readPositiveInteger(
      env.SUBMISSION_GLOBAL_RATE_LIMIT,
      DEFAULT_CONFIG.perIpLimit,
    ),
    windowMs:
      readPositiveInteger(
        env.SUBMISSION_RATE_WINDOW_SECONDS,
        DEFAULT_CONFIG.windowMs / 1000,
      ) * 1000,
    minFillMs:
      readPositiveInteger(
        env.SUBMISSION_MIN_FILL_SECONDS,
        DEFAULT_CONFIG.minFillMs / 1000,
      ) * 1000,
  };
}

export type SubmissionTrapInput = {
  honeypot: unknown;
  startedAt: unknown;
  now?: number;
  minFillMs?: number;
};

// A submission caught by a trap is answered as if it were accepted so bots get
// no signal, but nothing is stored. A missing or malformed startedAt is not
// held against the respondent: only a present and too-recent value trips it.
export function isSubmissionTrapped(input: SubmissionTrapInput) {
  if (typeof input.honeypot === "string" && input.honeypot.trim()) {
    return true;
  }

  if (typeof input.honeypot !== "string" && input.honeypot != null) {
    return true;
  }

  const startedAt =
    typeof input.startedAt === "number"
      ? input.startedAt
      : typeof input.startedAt === "string" && input.startedAt.trim()
        ? Number(input.startedAt)
        : Number.NaN;

  if (!Number.isFinite(startedAt)) {
    return false;
  }

  const now = input.now ?? Date.now();
  const minFillMs = input.minFillMs ?? DEFAULT_CONFIG.minFillMs;
  const elapsed = now - startedAt;

  return elapsed >= 0 && elapsed < minFillMs;
}

export type SubmissionRateLimiters = {
  perForm: SlidingWindowRateLimiter;
  perIp: SlidingWindowRateLimiter;
};

export function createSubmissionRateLimiters(
  config: SubmissionGuardConfig,
  now?: () => number,
): SubmissionRateLimiters {
  return {
    perForm: new SlidingWindowRateLimiter({
      limit: config.perFormLimit,
      windowMs: config.windowMs,
      now,
    }),
    perIp: new SlidingWindowRateLimiter({
      limit: config.perIpLimit,
      windowMs: config.windowMs,
      now,
    }),
  };
}

export function assertSubmissionRateAllowed(
  limiters: SubmissionRateLimiters,
  formKey: string,
  clientIp: string,
) {
  const perIp = limiters.perIp.hit(clientIp);

  if (!perIp.allowed) {
    throw new AppError("Too many submissions. Please try again later.", 429);
  }

  const perForm = limiters.perForm.hit(`${formKey}:${clientIp}`);

  if (!perForm.allowed) {
    throw new AppError("Too many submissions. Please try again later.", 429);
  }
}

let sharedLimiters: SubmissionRateLimiters | null = null;

export function getSharedSubmissionRateLimiters() {
  sharedLimiters ??= createSubmissionRateLimiters(getSubmissionGuardConfig());
  return sharedLimiters;
}
