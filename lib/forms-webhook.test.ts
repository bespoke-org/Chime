import { describe, expect, test } from "bun:test";

import type { WebhookDeliveryInput } from "@/lib/webhooks";

type FormRecord = {
  id: string;
  slug: string;
  title: string;
  status: "PUBLISHED";
  webhooks: Array<{ url: string; secret: string | null }>;
  closesAt: Date | null;
  maxResponses: number | null;
  closedManually: boolean;
  blocks: Array<Record<string, unknown>>;
};

let currentForm: FormRecord | null = null;
let createdResponses: Array<Record<string, unknown>> = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

// lib/forms reaches lib/i18n-server, whose "server-only" marker only resolves
// inside Next.js.
mock.module("server-only", () => ({}));

mock.module("@/lib/db", () => ({
  db: {
    form: {
      findFirst: async () => currentForm,
    },
    response: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdResponses.push(args.data);
        return {
          id: "resp-1",
          submittedAt: new Date("2026-10-18T10:00:00.000Z"),
          ...args.data,
        };
      },
    },
  },
}));

const { createAnonymousResponse } = await import("@/lib/forms");
const { setWebhookDeliverer } = await import("@/lib/webhooks");

function block(id: string, type: string, title: string, position: number) {
  const now = new Date("2026-10-18T09:00:00.000Z");
  return {
    id,
    formId: "form-1",
    type,
    title,
    description: "",
    required: false,
    position,
    config: {},
    createdAt: now,
    updatedAt: now,
  };
}

function resetTestState(overrides: Partial<FormRecord> = {}) {
  currentForm = {
    id: "form-1",
    slug: "demo",
    title: "Demo",
    status: "PUBLISHED",
    webhooks: [],
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    blocks: [
      block("intro", "TEXT", "Welcome", 0),
      block("q-1", "SHORT_TEXT", "Name", 1),
    ],
    ...overrides,
  };
  createdResponses = [];
}

function captureDeliveries() {
  const deliveries: WebhookDeliveryInput[] = [];
  setWebhookDeliverer(async (input) => {
    deliveries.push(input);
    return { ok: true, status: 200 };
  });
  return deliveries;
}

describe("createAnonymousResponse webhook", () => {
  test("does not call the deliverer when the form has no webhooks", async () => {
    resetTestState();
    const deliveries = captureDeliveries();

    try {
      const response = await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(response.id).toBe("resp-1");
      expect(createdResponses.length).toBe(1);
      expect(deliveries.length).toBe(0);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("delivers the stored response to the configured URL", async () => {
    resetTestState({
      webhooks: [{ url: "https://example.com/hook", secret: "s3cret" }],
    });
    const deliveries = captureDeliveries();

    try {
      await createAnonymousResponse("demo", { "q-1": " Ada " });

      expect(deliveries.length).toBe(1);
      expect(deliveries[0].url).toBe("https://example.com/hook");
      expect(deliveries[0].secret).toBe("s3cret");
      expect(JSON.stringify(deliveries[0].payload)).toBe(
        JSON.stringify({
          event: "response.created",
          formId: "form-1",
          formSlug: "demo",
          formTitle: "Demo",
          responseId: "resp-1",
          submittedAt: "2026-10-18T10:00:00.000Z",
          answers: [
            { blockId: "q-1", type: "SHORT_TEXT", title: "Name", value: "Ada" },
          ],
        }),
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("stores the response even when delivery fails", async () => {
    resetTestState({
      webhooks: [{ url: "https://example.com/hook", secret: null }],
    });
    let called = 0;
    setWebhookDeliverer(async () => {
      called += 1;
      return { ok: false, status: 500 };
    });

    try {
      const response = await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(response.id).toBe("resp-1");
      expect(createdResponses.length).toBe(1);
      expect(called).toBe(1);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("delivers the same payload to every webhook with its own secret", async () => {
    resetTestState({
      webhooks: [
        { url: "https://one.example.com/hook", secret: "first" },
        { url: "https://two.example.com/hook", secret: null },
      ],
    });
    const deliveries = captureDeliveries();

    try {
      await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(deliveries.map((delivery) => delivery.url).join(",")).toBe(
        "https://one.example.com/hook,https://two.example.com/hook",
      );
      expect(deliveries[0].secret).toBe("first");
      expect(deliveries[1].secret).toBe(null);
      expect(deliveries[0].payload).toBe(deliveries[1].payload);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("a failing webhook does not stop the others", async () => {
    resetTestState({
      webhooks: [
        { url: "https://down.example.com/hook", secret: null },
        { url: "https://up.example.com/hook", secret: null },
      ],
    });
    const called: string[] = [];
    setWebhookDeliverer(async (input) => {
      called.push(input.url);
      return input.url.includes("down")
        ? { ok: false, error: "timeout" }
        : { ok: true, status: 200 };
    });

    try {
      const response = await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(response.id).toBe("resp-1");
      expect(called.join(",")).toBe(
        "https://down.example.com/hook,https://up.example.com/hook",
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });
});
