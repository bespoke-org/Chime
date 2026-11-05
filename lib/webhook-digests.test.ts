import { describe, expect, test } from "bun:test";

import type { WebhookDeliveryInput } from "@/lib/webhooks";

type WebhookRow = {
  id: string;
  formId: string | null;
  organizationId?: string | null;
  url: string;
  secret: string | null;
  enabled: boolean;
  mode: "IMMEDIATE" | "DIGEST";
  digestInterval: "HOURLY" | "DAILY" | "WEEKLY" | null;
  digestTime: string | null;
  digestWeekday: number | null;
  lastDigestAt: Date | null;
  createdAt: Date;
  form: { id: string; slug: string; title: string } | null;
};

type FormRow = {
  id: string;
  slug: string;
  title: string;
  organizationId: string | null;
};

type ResponseRow = {
  id: string;
  formId: string;
  submittedAt: Date;
  answersJson: unknown;
  formSnapshotJson: unknown;
};

let webhooks: WebhookRow[] = [];
let forms: FormRow[] = [];
let responses: ResponseRow[] = [];
let updateCalls: Array<{ where: Record<string, unknown>; data: unknown }> = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

function inPeriod(
  response: ResponseRow,
  where: { formId: string; submittedAt: { gt: Date; lte: Date } },
) {
  return (
    response.formId === where.formId &&
    response.submittedAt.getTime() > where.submittedAt.gt.getTime() &&
    response.submittedAt.getTime() <= where.submittedAt.lte.getTime()
  );
}

mock.module("@/lib/db", () => ({
  db: {
    // Returns the organization's forms with their enabled digest webhooks,
    // as the select in organizationDigestForms asks for.
    form: {
      findMany: async (args: { where: { organizationId: string } }) =>
        forms
          .filter((row) => row.organizationId === args.where.organizationId)
          .map((row) => ({
            ...row,
            webhooks: webhooks
              .filter(
                (webhook) =>
                  webhook.formId === row.id &&
                  webhook.mode === "DIGEST" &&
                  webhook.enabled,
              )
              .map((webhook) => ({ url: webhook.url })),
          })),
    },
    formWebhook: {
      findMany: async () =>
        webhooks.filter(
          (webhook) => webhook.mode === "DIGEST" && webhook.enabled,
        ),
      updateMany: async (args: {
        where: { id: string; lastDigestAt: Date | null };
        data: { lastDigestAt: Date | null };
      }) => {
        updateCalls.push(args);
        const row = webhooks.find((webhook) => webhook.id === args.where.id);
        const matches =
          row &&
          (row.lastDigestAt?.getTime() ?? null) ===
            (args.where.lastDigestAt?.getTime() ?? null);
        if (!matches) {
          return { count: 0 };
        }
        row.lastDigestAt = args.data.lastDigestAt;
        return { count: 1 };
      },
    },
    response: {
      count: async (args: {
        where: { formId: string; submittedAt: { gt: Date; lte: Date } };
      }) =>
        responses.filter((response) => inPeriod(response, args.where)).length,
      findMany: async (args: {
        where: { formId: string; submittedAt: { gt: Date; lte: Date } };
        skip: number;
        take: number;
      }) =>
        responses
          .filter((response) => inPeriod(response, args.where))
          .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
          .slice(args.skip, args.skip + args.take),
    },
  },
}));

const { buildBatchPayload, runDueDigests, DIGEST_BATCH_SIZE } =
  await import("@/lib/webhook-digests");
const { setWebhookDeliverer, signWebhookPayload, deliverWebhook } =
  await import("@/lib/webhooks");

const form = { id: "form-1", slug: "demo", title: "Demo" };
const snapshot = [
  { id: "intro", type: "TEXT", title: "Welcome", position: 0, config: {} },
  {
    id: "q-1",
    type: "SHORT_TEXT",
    title: "Name",
    position: 1,
    config: { identity: true, identityKey: "name" },
  },
];

function dailyWebhook(overrides: Partial<WebhookRow> = {}): WebhookRow {
  return {
    id: "wh-1",
    formId: "form-1",
    url: "https://hooks.example.com/digest",
    secret: "s3cret",
    enabled: true,
    mode: "DIGEST",
    digestInterval: "DAILY",
    digestTime: "09:00",
    digestWeekday: null,
    // Created the day before, so the 09:00 Saratov slot (05:00Z) is due.
    lastDigestAt: null,
    createdAt: new Date("2026-10-18T12:00:00.000Z"),
    form,
    ...overrides,
  };
}

function response(
  id: string,
  submittedAt: string,
  name = "Ada",
  formId = "form-1",
): ResponseRow {
  return {
    id,
    formId,
    submittedAt: new Date(submittedAt),
    answersJson: { "q-1": name },
    formSnapshotJson: snapshot,
  };
}

function reset(
  rows: WebhookRow[],
  stored: ResponseRow[],
  organizationForms: FormRow[] = [],
) {
  webhooks = rows;
  responses = stored;
  forms = organizationForms;
  updateCalls = [];
  // The slots below are computed for Saratov (UTC+4 all year).
  process.env.DIGEST_TIMEZONE = "Europe/Saratov";
}

function captureDeliveries(ok = true) {
  const deliveries: WebhookDeliveryInput[] = [];
  setWebhookDeliverer(async (input) => {
    deliveries.push(input);
    return ok ? { ok: true, status: 200 } : { ok: false, status: 500 };
  });
  return deliveries;
}

const slot = new Date("2026-10-19T05:00:00.000Z");
const now = new Date("2026-10-19T05:30:00.000Z");

describe("buildBatchPayload", () => {
  test("lists responses with the response.created fields and identity", () => {
    const payload = buildBatchPayload(
      form,
      { start: new Date("2026-10-18T05:00:00.000Z"), end: slot },
      { index: 1, count: 1 },
      [
        response("r-1", "2026-10-18T10:00:00.000Z", "Ada"),
        response("r-2", "2026-10-19T01:00:00.000Z", "Bob"),
      ],
      "https://forms.example.com",
    );

    expect(JSON.stringify(payload)).toBe(
      JSON.stringify({
        event: "responses.batch",
        formId: "form-1",
        formSlug: "demo",
        formTitle: "Demo",
        periodStart: "2026-10-18T05:00:00.000Z",
        periodEnd: "2026-10-19T05:00:00.000Z",
        part: 1,
        parts: 1,
        responses: [
          {
            responseId: "r-1",
            submittedAt: "2026-10-18T10:00:00.000Z",
            identity: [
              { key: "name", blockId: "q-1", title: "Name", value: "Ada" },
            ],
            answers: [
              {
                blockId: "q-1",
                type: "SHORT_TEXT",
                title: "Name",
                value: "Ada",
              },
            ],
          },
          {
            responseId: "r-2",
            submittedAt: "2026-10-19T01:00:00.000Z",
            identity: [
              { key: "name", blockId: "q-1", title: "Name", value: "Bob" },
            ],
            answers: [
              {
                blockId: "q-1",
                type: "SHORT_TEXT",
                title: "Name",
                value: "Bob",
              },
            ],
          },
        ],
      }),
    );
  });

  test("is signed and sent like response.created", async () => {
    const payload = buildBatchPayload(
      form,
      { start: new Date("2026-10-18T05:00:00.000Z"), end: slot },
      { index: 1, count: 1 },
      [response("r-1", "2026-10-18T10:00:00.000Z")],
      "https://forms.example.com",
    );
    let headers: Record<string, string> = {};
    let body = "";

    await deliverWebhook({
      url: "https://hooks.example.com/digest",
      secret: "s3cret",
      payload,
      now: () => 1_760_000_000_000,
      lookup: async () => ["93.184.216.34"],
      fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
        headers = init?.headers as Record<string, string>;
        body = String(init?.body);
        return { ok: true, status: 200 } as Response;
      }) as typeof fetch,
    });

    expect(headers["x-chime-event"]).toBe("responses.batch");
    expect(headers["x-chime-signature"]).toBe(
      `sha256=${signWebhookPayload(body, "s3cret", 1_760_000_000)}`,
    );
    expect(body).toBe(JSON.stringify(payload));
  });
});

describe("runDueDigests", () => {
  test("sends the period's responses once and advances lastDigestAt", async () => {
    reset(
      [dailyWebhook()],
      [
        response("r-0", "2026-10-18T11:00:00.000Z"),
        response("r-1", "2026-10-18T13:00:00.000Z"),
        response("late", "2026-10-19T05:10:00.000Z"),
      ],
    );
    const deliveries = captureDeliveries();

    try {
      const summary = await runDueDigests(now);

      expect(summary.sent).toBe(1);
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].url).toBe("https://hooks.example.com/digest");
      expect(deliveries[0].secret).toBe("s3cret");
      const payload = deliveries[0].payload as {
        periodStart: string;
        periodEnd: string;
        responses: Array<{ responseId: string }>;
      };
      // The period starts at creation: r-0 was stored before the webhook.
      expect(payload.periodStart).toBe("2026-10-18T12:00:00.000Z");
      expect(payload.periodEnd).toBe("2026-10-19T05:00:00.000Z");
      expect(payload.responses.map((item) => item.responseId).join(",")).toBe(
        "r-1",
      );
      expect(webhooks[0].lastDigestAt?.toISOString()).toBe(
        "2026-10-19T05:00:00.000Z",
      );

      // The same tick again sends nothing.
      await runDueDigests(now);
      expect(deliveries.length).toBe(1);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("advances without sending when the period has no responses", async () => {
    reset([dailyWebhook()], []);
    const deliveries = captureDeliveries();

    try {
      const summary = await runDueDigests(now);

      expect(summary.empty).toBe(1);
      expect(deliveries.length).toBe(0);
      expect(webhooks[0].lastDigestAt?.toISOString()).toBe(
        "2026-10-19T05:00:00.000Z",
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("skips disabled, immediate and not yet due webhooks", async () => {
    reset(
      [
        dailyWebhook({ id: "off", enabled: false }),
        dailyWebhook({ id: "imm", mode: "IMMEDIATE" }),
        dailyWebhook({ id: "done", lastDigestAt: slot }),
      ],
      [response("r-1", "2026-10-18T13:00:00.000Z")],
    );
    const deliveries = captureDeliveries();

    try {
      await runDueDigests(now);

      expect(deliveries.length).toBe(0);
      expect(updateCalls.length).toBe(0);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("a failed delivery gives the slot back for the next tick", async () => {
    reset([dailyWebhook()], [response("r-1", "2026-10-18T13:00:00.000Z")]);
    captureDeliveries(false);

    try {
      const summary = await runDueDigests(now);

      expect(summary.failed).toBe(1);
      expect(webhooks[0].lastDigestAt).toBe(null);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("gives up on a slot after a day of failures", async () => {
    // Last delivered two days ago; everything since then failed.
    reset(
      [dailyWebhook({ lastDigestAt: new Date("2026-10-17T05:00:00.000Z") })],
      [response("r-1", "2026-10-18T13:00:00.000Z")],
    );
    captureDeliveries(false);

    try {
      const summary = await runDueDigests(now);

      expect(summary.dropped).toBe(1);
      expect(webhooks[0].lastDigestAt?.toISOString()).toBe(
        "2026-10-19T05:00:00.000Z",
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("splits a long period into parts and needs all of them to succeed", async () => {
    const stored: ResponseRow[] = [];
    for (let index = 0; index < DIGEST_BATCH_SIZE + 1; index += 1) {
      stored.push(
        response(
          `r-${String(index).padStart(3, "0")}`,
          new Date(Date.UTC(2026, 9, 18, 13, 0, index)).toISOString(),
        ),
      );
    }
    reset([dailyWebhook()], stored);
    const deliveries = captureDeliveries();

    try {
      await runDueDigests(now);

      expect(deliveries.length).toBe(2);
      const parts = deliveries.map((delivery) => {
        const payload = delivery.payload as {
          part: number;
          parts: number;
          responses: Array<{ responseId: string }>;
        };
        return `${payload.part}/${payload.parts}:${payload.responses.length}`;
      });
      expect(parts.join(" ")).toBe("1/2:200 2/2:1");
      const second = deliveries[1].payload as {
        responses: Array<{ responseId: string }>;
      };
      expect(second.responses[0].responseId).toBe("r-200");
    } finally {
      setWebhookDeliverer(null);
    }

    // When the second part fails the slot is not kept.
    reset([dailyWebhook()], stored);
    let calls = 0;
    setWebhookDeliverer(async () => {
      calls += 1;
      return calls === 1
        ? { ok: true, status: 200 }
        : { ok: false, status: 500 };
    });

    try {
      const summary = await runDueDigests(now);

      expect(calls).toBe(2);
      expect(summary.failed).toBe(1);
      expect(webhooks[0].lastDigestAt).toBe(null);
    } finally {
      setWebhookDeliverer(null);
    }
  });
});

describe("runDueDigests for organization webhooks", () => {
  const orgForms: FormRow[] = [
    { id: "form-1", slug: "demo", title: "Demo", organizationId: "org-1" },
    { id: "form-2", slug: "second", title: "Second", organizationId: "org-1" },
    { id: "form-3", slug: "quiet", title: "Quiet", organizationId: "org-1" },
    { id: "other", slug: "other", title: "Other", organizationId: "org-2" },
  ];

  function orgWebhook(overrides: Partial<WebhookRow> = {}) {
    return dailyWebhook({
      id: "wh-org",
      formId: null,
      organizationId: "org-1",
      secret: "org",
      form: null,
      ...overrides,
    });
  }

  type BatchSummary = {
    formId: string;
    periodStart: string;
    responses: Array<{ responseId: string }>;
  };

  function describeDeliveries(deliveries: WebhookDeliveryInput[]) {
    return deliveries
      .map((delivery) => {
        const payload = delivery.payload as BatchSummary;
        return `${delivery.secret}:${payload.formId}:${payload.responses
          .map((item) => item.responseId)
          .join("+")}`;
      })
      .join(" ");
  }

  test("sends one batch per form of the organization that has responses", async () => {
    reset(
      [orgWebhook()],
      [
        response("a-1", "2026-10-18T13:00:00.000Z", "Ada", "form-1"),
        response("a-2", "2026-10-18T14:00:00.000Z", "Bob", "form-1"),
        response("b-1", "2026-10-18T15:00:00.000Z", "Cy", "form-2"),
        response("x-1", "2026-10-18T15:00:00.000Z", "Dee", "other"),
      ],
      orgForms,
    );
    const deliveries = captureDeliveries();

    try {
      const summary = await runDueDigests(now);

      expect(summary.sent).toBe(1);
      expect(describeDeliveries(deliveries)).toBe(
        "org:form-1:a-1+a-2 org:form-2:b-1",
      );
      const first = deliveries[0].payload as BatchSummary;
      expect(first.periodStart).toBe("2026-10-18T12:00:00.000Z");
      expect(webhooks[0].lastDigestAt?.toISOString()).toBe(
        "2026-10-19T05:00:00.000Z",
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("counts an organization period without responses as empty", async () => {
    reset([orgWebhook()], [], orgForms);
    const deliveries = captureDeliveries();

    try {
      const summary = await runDueDigests(now);

      expect(summary.empty).toBe(1);
      expect(deliveries.length).toBe(0);
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("leaves out a form whose own digest webhook has the same URL", async () => {
    reset(
      [
        dailyWebhook({
          id: "wh-form",
          url: "https://HOOKS.example.com/digest/",
          secret: "form",
        }),
        // A different URL on form-2 does not hold back the organization.
        dailyWebhook({
          id: "wh-form-2",
          formId: "form-2",
          url: "https://elsewhere.example.com/digest",
          secret: "elsewhere",
          form: { id: "form-2", slug: "second", title: "Second" },
        }),
        orgWebhook(),
      ],
      [
        response("a-1", "2026-10-18T13:00:00.000Z", "Ada", "form-1"),
        response("b-1", "2026-10-18T15:00:00.000Z", "Cy", "form-2"),
      ],
      orgForms,
    );
    const deliveries = captureDeliveries();

    try {
      const summary = await runDueDigests(now);

      expect(summary.sent).toBe(3);
      expect(describeDeliveries(deliveries)).toBe(
        "form:form-1:a-1 elsewhere:form-2:b-1 org:form-2:b-1",
      );
    } finally {
      setWebhookDeliverer(null);
    }
  });

  test("a failed form gives the whole organization period back", async () => {
    reset(
      [orgWebhook()],
      [
        response("a-1", "2026-10-18T13:00:00.000Z", "Ada", "form-1"),
        response("b-1", "2026-10-18T15:00:00.000Z", "Cy", "form-2"),
      ],
      orgForms,
    );
    const formIds: string[] = [];
    setWebhookDeliverer(async (input) => {
      const payload = input.payload as BatchSummary;
      formIds.push(payload.formId);
      return payload.formId === "form-2"
        ? { ok: false, status: 500 }
        : { ok: true, status: 200 };
    });

    try {
      const summary = await runDueDigests(now);

      expect(summary.failed).toBe(1);
      expect(formIds.join(",")).toBe("form-1,form-2");
      expect(webhooks[0].lastDigestAt).toBe(null);

      // The next tick sends both forms again.
      formIds.length = 0;
      await runDueDigests(now);
      expect(formIds.join(",")).toBe("form-1,form-2");
    } finally {
      setWebhookDeliverer(null);
    }
  });
});
