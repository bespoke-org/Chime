import { describe, expect, test } from "bun:test";

import {
  createTimeoutFetch,
  getSafeAtprotoCallbackUrl,
} from "./atproto-auth-utils";

async function captureRejection(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error("Expected promise to reject");
  } catch (error) {
    return error;
  }
}

describe("createTimeoutFetch", () => {
  test("aborts a stalled request after the configured timeout", async () => {
    const stalledFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      })) as typeof fetch;
    const timedFetch = createTimeoutFetch(stalledFetch, 10);
    const error = await captureRejection(timedFetch("https://example.com"));

    expect((error as { name?: string }).name).toBe("TimeoutError");
  });

  test("preserves an earlier caller abort", async () => {
    const stalledFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      })) as typeof fetch;
    const timedFetch = createTimeoutFetch(stalledFetch, 1_000);
    const controller = new AbortController();
    const request = timedFetch("https://example.com", {
      signal: controller.signal,
    });

    controller.abort(new Error("caller aborted"));
    const error = await captureRejection(request);

    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toBe("caller aborted");
  });
});

describe("getSafeAtprotoCallbackUrl", () => {
  test("keeps same-origin application paths", () => {
    expect(getSafeAtprotoCallbackUrl("/forms/new?from=login")).toBe(
      "/forms/new?from=login",
    );
  });

  test("rejects absolute and backslash-based external redirects", () => {
    expect(getSafeAtprotoCallbackUrl("https://evil.example/path")).toBe(
      "/dashboard",
    );
    expect(getSafeAtprotoCallbackUrl("//evil.example/path")).toBe("/dashboard");
    expect(getSafeAtprotoCallbackUrl("/\\evil.example/path")).toBe(
      "/dashboard",
    );
  });
});
