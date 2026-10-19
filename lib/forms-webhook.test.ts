import { describe, expect, test } from "bun:test";

import type { WebhookDeliveryInput } from "@/lib/webhooks";

type WebhookRecord = {
  url: string;
  secret: string | null;
  enabled?: boolean;
  mode?: "IMMEDIATE" | "DIGEST";
};

type FormRecord = {
  id: string;
  slug: string;
  title: string;
  status: "PUBLISHED";
  webhooks: WebhookRecord[];
  organization?: { webhooks: WebhookRecord[] } | null;
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

type WebhookWhere = { where: { enabled: boolean; mode: string } };

function applyWebhookWhere(webhooks: WebhookRecord[], filter: WebhookWhere) {
  return webhooks.filter(
    (webhook) =>
      (webhook.enabled ?? true) === filter.where.enabled &&
      (webhook.mode ?? "IMMEDIATE") === filter.where.mode,
  );
}

mock.module("@/lib/db", () => ({
  db: {
    form: {
      // Applies the include filters on webhooks the way the database would.
      findFirst: async (args: {
        include: {
          webhooks: WebhookWhere;
          organization: { select: { webhooks: WebhookWhere } };
        };
      }) =>
        currentForm && {
          ...currentForm,
          webhooks: applyWebhookWhere(
            currentForm.webhooks,
            args.include.webhooks,
          ),
          organization: currentForm.organization
            ? {
                webhooks: applyWebhookWhere(
                  currentForm.organization.webhooks,
                  args.include.organization.select.webhooks,
                ),
              }
            : null,
        },
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

function block(
  id: string,
  type: string,
  title: string,
  position: number,
  config: Record<string, unknown> = {},
) {
  const now = new Date("2026-10-18T09:00:00.000Z");
  return {
    id,
    formId: "form-1",
    type,
    title,
    description: "",
    required: false,
    position,
    config,
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
      blocks: [
        block("intro", "TEXT", "Welcome", 0),
        block("q-1", "SHORT_TEXT", "Name", 1, {
          identity: true,
          identityKey: "name",
        }),
      ],
    });
    const deliveries = captureDeliveries();
    const previousBaseUrl = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = "https://forms.example.com";

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
          formUrl: "https://forms.example.com/f/demo",
          responseId: "resp-1",
          responseUrl:
            "https://forms.example.com/forms/form-1/responses/resp-1",
          submittedAt: "2026-10-18T10:00:00.000Z",
          identity: [
            { key: "name", blockId: "q-1", title: "Name", value: "Ada" },
          ],
          answers: [
            { blockId: "q-1", type: "SHORT_TEXT", title: "Name", value: "Ada" },
          ],
        }),
      );
    } finally {
      if (previousBaseUrl === undefined) {
        delete process.env.NEXTAUTH_URL;
      } else {
        process.env.NEXTAUTH_URL = previousBaseUrl;
      }
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

  test("skips disabled and digest webhooks", async () => {
    resetTestState({
      webhooks: [
        { url: "https://off.example.com/hook", secret: null, enabled: false },
        {
          url: "https://digest.example.com/hook",
          secret: null,
          mode: "DIGEST",
        },
        { url: "https://now.example.com/hook", secret: null },
      ],
    });
    const deliveries = captureDeliveries();

    try {
      await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(deliveries.map((delivery) => delivery.url).join(",")).toBe(
        "https://now.example.com/hook",
      );
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

  test("delivers to the organization's immediate webhooks after the form's", async () => {
    resetTestState({
      webhooks: [{ url: "https://form.example.com/hook", secret: "form" }],
      organization: {
        webhooks: [
          { url: "https://org.example.com/hook", secret: "org" },
          {
            url: "https://org-digest.example.com/hook",
            secret: null,
            mode: "DIGEST",
          },
          {
            url: "https://org-off.example.com/hook",
            secret: null,
            enabled: false,
          },
        ],
      },
    });
    const deliveries = captureDeliveries();

    try {
      await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(deliveries.map((delivery) => delivery.url).join(",")).toBe(
        "https://form.example.com/hook,https://org.example.com/hook",
      );
      expect(deliveries[1].secret).toBe("org");
      expect(deliveries[0].payload).toBe(deliveries[1].payload);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("an organization webhook with the form webhook's URL is sent once, with the form's secret", async () => {
    resetTestState({
      webhooks: [{ url: "https://hooks.example.com/lively", secret: "form" }],
      organization: {
        webhooks: [
          { url: "HTTPS://Hooks.Example.com/lively/", secret: "org" },
          { url: "https://hooks.example.com/lively?team=a", secret: "query" },
        ],
      },
    });
    const deliveries = captureDeliveries();

    try {
      await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(deliveries.map((delivery) => delivery.secret).join(",")).toBe(
        "form,query",
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("a disabled or digest form webhook does not hold back the organization's", async () => {
    resetTestState({
      webhooks: [
        { url: "https://hooks.example.com/a", secret: null, enabled: false },
        { url: "https://hooks.example.com/b", secret: null, mode: "DIGEST" },
      ],
      organization: {
        webhooks: [
          { url: "https://hooks.example.com/a", secret: "org-a" },
          { url: "https://hooks.example.com/b", secret: "org-b" },
        ],
      },
    });
    const deliveries = captureDeliveries();

    try {
      await createAnonymousResponse("demo", { "q-1": "Ada" });

      expect(deliveries.map((delivery) => delivery.secret).join(",")).toBe(
        "org-a,org-b",
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });
});
