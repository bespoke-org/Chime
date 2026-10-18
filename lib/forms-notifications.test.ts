import { describe, expect, test } from "bun:test";

import type { MailMessage } from "@/lib/mailer";

type FormRecord = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  status: "PUBLISHED";
  webhookUrl: null;
  webhookSecret: null;
  closesAt: Date | null;
  maxResponses: number | null;
  closedManually: boolean;
  blocks: Array<Record<string, unknown>>;
};

let currentForm: FormRecord | null = null;
let createdResponses: Array<Record<string, unknown>> = [];
let subscriptionLookups = 0;

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

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
    formNotificationSubscription: {
      findMany: async () => {
        subscriptionLookups += 1;
        return [
          {
            user: {
              id: "user-1",
              notificationEmail: "owner@example.com",
              locale: "en",
            },
          },
        ];
      },
    },
  },
}));

const { createAnonymousResponse } = await import("@/lib/forms");
const { setResponseNotificationMailer } =
  await import("@/lib/response-notifications");

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

function resetTestState() {
  currentForm = {
    id: "form-1",
    userId: "user-1",
    slug: "demo",
    title: "Demo",
    status: "PUBLISHED",
    webhookUrl: null,
    webhookSecret: null,
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    blocks: [
      block("intro", "TEXT", "Welcome", 0),
      block("q-1", "SHORT_TEXT", "Name", 1),
    ],
  };
  createdResponses = [];
  subscriptionLookups = 0;
}

// The notification is fired without being awaited, so the test yields to the
// event loop before checking what the mailer saw.
function settle() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("createAnonymousResponse email notification", () => {
  test("does not read subscribers when the mailer is not configured", async () => {
    resetTestState();
    const sent: MailMessage[] = [];
    setResponseNotificationMailer({
      isConfigured: () => false,
      sendMail: async (message) => {
        sent.push(message);
        return { ok: true };
      },
    });

    try {
      await createAnonymousResponse("demo", { "q-1": "Ada" });
      await settle();

      expect(createdResponses.length).toBe(1);
      expect(subscriptionLookups).toBe(0);
      expect(sent.length).toBe(0);
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("emails the subscribers after the response is stored", async () => {
    resetTestState();
    const sent: MailMessage[] = [];
    let responsesWhenSent = -1;
    setResponseNotificationMailer({
      isConfigured: () => true,
      sendMail: async (message) => {
        responsesWhenSent = createdResponses.length;
        sent.push(message);
        return { ok: true };
      },
    });

    try {
      const response = await createAnonymousResponse("demo", {
        "q-1": " Ada ",
      });
      await settle();

      expect(response.id).toBe("resp-1");
      expect(responsesWhenSent).toBe(1);
      expect(sent.length).toBe(1);
      expect(sent[0].to).toBe("owner@example.com");
      expect(sent[0].subject).toBe("New response: Demo");
      expect(sent[0].text).toContain("Name\nAda");
      expect(sent[0].text).toContain("/forms/form-1/responses/resp-1");
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("stores the response when the mailer reports a failure", async () => {
    resetTestState();
    let attempts = 0;
    const originalWarn = console.warn;
    console.warn = () => {};
    setResponseNotificationMailer({
      isConfigured: () => true,
      sendMail: async () => {
        attempts += 1;
        return { ok: false, error: "connection refused" };
      },
    });

    try {
      const response = await createAnonymousResponse("demo", { "q-1": "Ada" });
      await settle();

      expect(response.id).toBe("resp-1");
      expect(createdResponses.length).toBe(1);
      expect(attempts).toBe(1);
    } finally {
      console.warn = originalWarn;
      setResponseNotificationMailer(null);
    }
  });
});
