const OAUTH_FETCH_TIMEOUT_MS = 10_000;

export function getAtprotoPublicBaseUrl() {
  const baseUrl =
    process.env.ATPROTO_PUBLIC_URL ??
    process.env.NEXTAUTH_URL ??
    "http://127.0.0.1:3000";

  return baseUrl.replace(/\/$/, "");
}

export function createTimeoutFetch(
  fetchImplementation: typeof fetch,
  timeoutMs = OAUTH_FETCH_TIMEOUT_MS,
): typeof fetch {
  return (input, init) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    return fetchImplementation(input, { ...init, signal });
  };
}

function isSafeCallbackUrl(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return false;
  }

  try {
    const baseUrl = new URL(getAtprotoPublicBaseUrl());
    return new URL(value, baseUrl).origin === baseUrl.origin;
  } catch {
    return false;
  }
}

export function getSafeAtprotoCallbackUrl(
  value: string | null | undefined,
): string {
  return isSafeCallbackUrl(value) ? value : "/dashboard";
}
