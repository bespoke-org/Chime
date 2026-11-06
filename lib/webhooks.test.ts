import { createHmac } from "node:crypto";

import { describe, expect, test } from "bun:test";

import {
  parseSubmissionPayload,
  type SubmissionSnapshotBlock,
} from "@/lib/form-submission";
import {
  buildWebhookPayload,
  deliverWebhook,
  isPublicIpAddress,
  isPublicWebhookTarget,
  isPublicWebhookUrl,
  signWebhookPayload,
  type WebhookPayload,
} from "@/lib/webhooks";

const publicLookup = async () => ["93.184.216.34"];

describe("isPublicWebhookUrl", () => {
  test("accepts public http and https hosts", () => {
    for (const url of [
      "https://hooks.example.com/chime",
      "http://example.com:8080/path?x=1",
      "HTTPS://EXAMPLE.COM/Hook",
      "  https://example.com/hook  ",
      "https://[2001:db8::1]/hook",
      "https://8.8.8.8/hook",
      "https://172.32.0.1/hook",
      "https://172.15.0.1/hook",
      "https://100.128.0.1/hook",
      "https://100.63.255.255/hook",
    ]) {
      expect(isPublicWebhookUrl(url)).toBe(true);
    }
  });

  test("rejects non-http schemes and malformed values", () => {
    for (const url of [
      "ftp://example.com/x",
      "example.com",
      "",
      "javascript:1",
    ]) {
      expect(isPublicWebhookUrl(url)).toBe(false);
    }
  });

  test("rejects loopback, private, link-local and unspecified addresses", () => {
    for (const url of [
      "https://localhost/hook",
      "https://app.localhost/hook",
      "https://127.0.0.1/hook",
      "https://127.1.2.3/hook",
      "https://10.0.0.5/hook",
      "https://172.16.0.1/hook",
      "https://172.31.255.255/hook",
      "https://192.168.1.1/hook",
      "https://169.254.169.254/latest",
      "https://100.64.0.1/hook",
      "https://100.127.255.255/hook",
      "https://224.0.0.251/hook",
      "https://255.255.255.255/hook",
      "https://0.0.0.0/hook",
      "https://[::1]/hook",
      "https://[::ffff:127.0.0.1]/hook",
      "https://[::ffff:7f00:1]/hook",
      "https://[fd00::1]/hook",
      "https://[fe80::1]/hook",
      "https://[ff02::1]/hook",
    ]) {
      expect(isPublicWebhookUrl(url)).toBe(false);
    }
  });

  test("rejects .local and .internal hostnames", () => {
    expect(isPublicWebhookUrl("https://foo.local/hook")).toBe(false);
    expect(isPublicWebhookUrl("https://db.internal/hook")).toBe(false);
    expect(isPublicWebhookUrl("https://Printer.LOCAL/hook")).toBe(false);
  });

  test("rejects credentials in the URL", () => {
    expect(isPublicWebhookUrl("https://user:pass@example.com/hook")).toBe(
      false,
    );
    expect(isPublicWebhookUrl("https://user@example.com/hook")).toBe(false);
  });
});

describe("isPublicIpAddress", () => {
  test("classifies plain and IPv4-mapped addresses", () => {
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("2001:db8::1")).toBe(true);
    expect(isPublicIpAddress("10.1.2.3")).toBe(false);
    expect(isPublicIpAddress("100.64.1.1")).toBe(false);
    expect(isPublicIpAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("::ffff:a00:1")).toBe(false);
    expect(isPublicIpAddress("::ffff:5db8:d822")).toBe(true);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isPublicIpAddress("not-an-ip")).toBe(false);
  });
});

describe("isPublicWebhookTarget", () => {
  test("accepts a name whose addresses are all public", async () => {
    const seen: string[] = [];
    const lookup = async (hostname: string) => {
      seen.push(hostname);
      return ["93.184.216.34", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"];
    };

    expect(
      await isPublicWebhookTarget("https://example.com/hook", lookup),
    ).toBe(true);
    expect(seen.join(",")).toBe("example.com");
  });

  test("rejects a name that resolves to a private or mapped address", async () => {
    for (const addresses of [
      ["127.0.0.1"],
      ["93.184.216.34", "10.0.0.5"],
      ["::ffff:10.0.0.5"],
      ["100.64.0.9"],
      ["fd00::1"],
      [],
    ]) {
      expect(
        await isPublicWebhookTarget(
          "https://127.0.0.1.nip.io/hook",
          async () => addresses,
        ),
      ).toBe(false);
    }
  });

  test("rejects a name that does not resolve", async () => {
    expect(
      await isPublicWebhookTarget("https://example.invalid/hook", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).toBe(false);
  });

  test("does not resolve IP literals and keeps the shape check", async () => {
    const lookup = async () => {
      throw new Error("should not be called");
    };

    expect(await isPublicWebhookTarget("https://8.8.8.8/hook", lookup)).toBe(
      true,
    );
    expect(await isPublicWebhookTarget("https://[2001:db8::1]/", lookup)).toBe(
      true,
    );
    expect(await isPublicWebhookTarget("https://10.0.0.1/hook", lookup)).toBe(
      false,
    );
    expect(await isPublicWebhookTarget("ftp://example.com/x", lookup)).toBe(
      false,
    );
  });
});

describe("signWebhookPayload", () => {
  test("returns the hex HMAC-SHA256 of timestamp.body", () => {
    const body = '{"event":"response.created"}';
    const expected = createHmac("sha256", "s3cret")
      .update(`1700000000.${body}`)
      .digest("hex");

    expect(signWebhookPayload(body, "s3cret", 1700000000)).toBe(expected);
    expect(signWebhookPayload(body, "other", 1700000000) === expected).toBe(
      false,
    );
  });
});

function snapshotBlock(
  overrides: Partial<SubmissionSnapshotBlock> & { id: string },
): SubmissionSnapshotBlock {
  return {
    type: "SHORT_TEXT",
    title: `Block ${overrides.id}`,
    description: "",
    required: false,
    position: 0,
    config: {},
    ...overrides,
  } as SubmissionSnapshotBlock;
}

describe("buildWebhookPayload", () => {
  test("lists visited question answers in snapshot order", () => {
    const payload = buildWebhookPayload(
      { id: "form-1", slug: "demo", title: "Demo" },
      {
        id: "resp-1",
        submittedAt: new Date("2026-10-18T10:00:00.000Z"),
        answers: {
          "q-1": "Ada",
          "q-2": ["a", "b"],
          "q-skipped": "never reached",
        },
      },
      [
        snapshotBlock({ id: "intro", type: "TEXT", title: "Welcome" }),
        snapshotBlock({ id: "q-1", title: "Name" }),
        snapshotBlock({ id: "q-2", type: "MULTIPLE_CHOICE", title: "" }),
        snapshotBlock({ id: "q-empty", title: "Optional" }),
      ],
    );

    expect(payload.event).toBe("response.created");
    expect(payload.formId).toBe("form-1");
    expect(payload.formSlug).toBe("demo");
    expect(payload.formTitle).toBe("Demo");
    expect(payload.responseId).toBe("resp-1");
    expect(payload.submittedAt).toBe("2026-10-18T10:00:00.000Z");
    expect(JSON.stringify(payload.answers)).toBe(
      JSON.stringify([
        { blockId: "q-1", type: "SHORT_TEXT", title: "Name", value: "Ada" },
        {
          blockId: "q-2",
          type: "MULTIPLE_CHOICE",
          title: "",
          value: ["a", "b"],
        },
      ]),
    );
  });
});

type FakeCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};

function createFakeFetch(
  responders: Array<(call: FakeCall) => Response | Promise<Response>>,
) {
  const calls: FakeCall[] = [];

  const fetchImpl = ((url: string | URL, init?: RequestInit) => {
    const call: FakeCall = {
      url: String(url),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: String(init?.body ?? ""),
    };
    calls.push(call);
    const responder =
      responders[Math.min(calls.length - 1, responders.length - 1)];
    return Promise.resolve(responder(call));
  }) as unknown as typeof fetch;

  return { calls, fetchImpl };
}

function payload(): WebhookPayload {
  return {
    event: "response.created",
    formId: "form-1",
    formSlug: "demo",
    formTitle: "Demo",
    formUrl: "https://forms.example.com/f/demo",
    responseId: "resp-1",
    responseUrl: "https://forms.example.com/forms/form-1/responses/resp-1",
    submittedAt: "2026-10-18T10:00:00.000Z",
    identity: [],
    answers: [
      { blockId: "q-1", type: "SHORT_TEXT", title: "Name", value: "Ada" },
    ],
  };
}

const quietWarn = async <T>(run: () => Promise<T>) => {
  const original = console.warn;
  console.warn = () => {};

  try {
    return await run();
  } finally {
    console.warn = original;
  }
};

describe("deliverWebhook", () => {
  test("does not send to a host that resolves to a private address", async () => {
    const { calls, fetchImpl } = createFakeFetch([
      () => new Response(null, { status: 200 }),
    ]);

    const result = await quietWarn(() =>
      deliverWebhook({
        url: "https://127.0.0.1.nip.io/hook",
        secret: null,
        payload: payload(),
        fetchImpl,
        lookup: async () => ["127.0.0.1"],
        retryDelayMs: 0,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("blocked_address");
    expect(calls.length).toBe(0);
  });

  test("posts signed JSON once on success", async () => {
    const { calls, fetchImpl } = createFakeFetch([
      () => new Response(null, { status: 200 }),
    ]);

    const result = await deliverWebhook({
      url: "https://example.com/hook",
      secret: "s3cret",
      payload: payload(),
      lookup: publicLookup,
      fetchImpl,
      now: () => 1700000000123,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe("https://example.com/hook");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["content-type"]).toBe("application/json");
    expect(calls[0].headers["user-agent"]).toBe("chime-webhook/1");
    expect(calls[0].headers["x-chime-event"]).toBe("response.created");
    expect(calls[0].headers["x-chime-timestamp"]).toBe("1700000000");
    expect(calls[0].body).toBe(JSON.stringify(payload()));
    expect(calls[0].headers["x-chime-signature"]).toBe(
      `sha256=${signWebhookPayload(calls[0].body, "s3cret", 1700000000)}`,
    );
  });

  test("omits the signature header without a secret", async () => {
    const { calls, fetchImpl } = createFakeFetch([
      () => new Response(null, { status: 204 }),
    ]);

    await deliverWebhook({
      url: "https://example.com/hook",
      secret: null,
      payload: payload(),
      lookup: publicLookup,
      fetchImpl,
    });

    expect("x-chime-signature" in calls[0].headers).toBe(false);
    expect(calls[0].headers["x-chime-event"]).toBe("response.created");
  });

  test("does not retry a 4xx answer", async () => {
    const { calls, fetchImpl } = createFakeFetch([
      () => new Response(null, { status: 404 }),
    ]);

    const result = await quietWarn(() =>
      deliverWebhook({
        url: "https://example.com/hook",
        secret: null,
        payload: payload(),
        lookup: publicLookup,
        fetchImpl,
        retryDelayMs: 0,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(calls.length).toBe(1);
  });

  test("retries once after a 5xx answer and then gives up", async () => {
    const { calls, fetchImpl } = createFakeFetch([
      () => new Response(null, { status: 503 }),
    ]);

    const result = await quietWarn(() =>
      deliverWebhook({
        url: "https://example.com/hook",
        secret: null,
        payload: payload(),
        lookup: publicLookup,
        fetchImpl,
        retryDelayMs: 0,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(calls.length).toBe(2);
  });

  test("retries once after a network error and reports it", async () => {
    const { calls, fetchImpl } = createFakeFetch([
      () => {
        throw new Error("ECONNREFUSED");
      },
    ]);

    const result = await quietWarn(() =>
      deliverWebhook({
        url: "https://example.com/hook",
        secret: null,
        payload: payload(),
        lookup: publicLookup,
        fetchImpl,
        retryDelayMs: 0,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
    expect(calls.length).toBe(2);
  });

  test("succeeds when the retry succeeds", async () => {
    const { calls, fetchImpl } = createFakeFetch([
      () => new Response(null, { status: 500 }),
      () => new Response(null, { status: 200 }),
    ]);

    const result = await deliverWebhook({
      url: "https://example.com/hook",
      secret: null,
      payload: payload(),
      lookup: publicLookup,
      fetchImpl,
      retryDelayMs: 0,
    });

    expect(result.ok).toBe(true);
    expect(calls.length).toBe(2);
  });

  test("aborts a hanging request after the timeout", async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      })) as unknown as typeof fetch;

    const result = await quietWarn(() =>
      deliverWebhook({
        url: "https://example.com/hook",
        secret: null,
        payload: payload(),
        lookup: publicLookup,
        fetchImpl,
        timeoutMs: 10,
        retryDelayMs: 0,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });
});

describe("buildWebhookPayload file answers", () => {
  test("converts repeating file answers to download URLs and preserves empty instances", () => {
    const payload = buildWebhookPayload(
      { id: "form-1", slug: "demo", title: "Demo" },
      {
        id: "resp-1",
        submittedAt: new Date("2026-10-18T10:00:00.000Z"),
        answers: parseSubmissionPayload({ cv: ["up1", null, "up3"] }),
      },
      [snapshotBlock({ id: "cv", type: "FILE_UPLOAD", title: "CV" })],
      "https://forms.example.com",
    );

    expect(payload.answers[0]?.value).toEqual([
      "https://forms.example.com/api/forms/form-1/uploads/up1",
      null,
      "https://forms.example.com/api/forms/form-1/uploads/up3",
    ]);
  });

  test("sends the download URL instead of the upload id", () => {
    const payload = buildWebhookPayload(
      { id: "form-1", slug: "demo", title: "Demo" },
      {
        id: "resp-1",
        submittedAt: new Date("2026-10-18T10:00:00.000Z"),
        answers: { cv: "up1" },
      },
      [snapshotBlock({ id: "cv", type: "FILE_UPLOAD", title: "CV" })],
      "https://forms.example.com",
    );

    expect(JSON.stringify(payload.answers)).toBe(
      JSON.stringify([
        {
          blockId: "cv",
          type: "FILE_UPLOAD",
          title: "CV",
          value: "https://forms.example.com/api/forms/form-1/uploads/up1",
        },
      ]),
    );
  });
});
