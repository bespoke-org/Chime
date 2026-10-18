import { describe, expect, test } from "bun:test";

type Call = { method: string; args: Record<string, unknown> };

let accessibleForm: { id: string } | null = null;
let existingSubscription: { formId: string } | null = null;
let subscribers: Array<{
  user: { id: string; notificationEmail: string | null; locale: string | null };
}> = [];
let calls: Call[] = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    form: {
      findFirst: async (args: Record<string, unknown>) => {
        calls.push({ method: "form.findFirst", args });
        return accessibleForm;
      },
    },
    formNotificationSubscription: {
      findUnique: async (args: Record<string, unknown>) => {
        calls.push({ method: "subscription.findUnique", args });
        return existingSubscription;
      },
      upsert: async (args: Record<string, unknown>) => {
        calls.push({ method: "subscription.upsert", args });
        return {};
      },
      deleteMany: async (args: Record<string, unknown>) => {
        calls.push({ method: "subscription.deleteMany", args });
        return { count: 1 };
      },
      findMany: async (args: Record<string, unknown>) => {
        calls.push({ method: "subscription.findMany", args });
        return subscribers;
      },
    },
  },
}));

const {
  getNotificationSubscriptionForUser,
  listNotificationRecipients,
  setNotificationSubscription,
} = await import("@/lib/notification-subscriptions");
const { AppError } = await import("@/lib/errors");

function reset() {
  accessibleForm = { id: "form-1" };
  existingSubscription = null;
  subscribers = [];
  calls = [];
}

function writes() {
  return calls.filter((call) => call.method !== "form.findFirst");
}

describe("setNotificationSubscription", () => {
  test("creates the subscription when enabling", async () => {
    reset();

    const result = await setNotificationSubscription("user-1", "form-1", true);

    expect(result).toBe(true);
    expect(writes().length).toBe(1);
    expect(writes()[0].method).toBe("subscription.upsert");
    expect(JSON.stringify(writes()[0].args.create)).toBe(
      '{"formId":"form-1","userId":"user-1"}',
    );
  });

  test("deletes the subscription when disabling", async () => {
    reset();

    const result = await setNotificationSubscription("user-1", "form-1", false);

    expect(result).toBe(false);
    expect(writes().length).toBe(1);
    expect(writes()[0].method).toBe("subscription.deleteMany");
    expect(JSON.stringify(writes()[0].args.where)).toBe(
      '{"formId":"form-1","userId":"user-1"}',
    );
  });

  test("answers 404 and writes nothing for a form the user cannot open", async () => {
    reset();
    accessibleForm = null;
    let caught: unknown = null;

    try {
      await setNotificationSubscription("user-1", "form-1", true);
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof AppError).toBe(true);
    expect((caught as InstanceType<typeof AppError>).status).toBe(404);
    expect(writes().length).toBe(0);
    expect(JSON.stringify(calls[0].args.where)).toContain('"id":"form-1"');
    expect(JSON.stringify(calls[0].args.where)).toContain('"userId":"user-1"');
  });
});

describe("getNotificationSubscriptionForUser", () => {
  test("reports whether a subscription row exists", async () => {
    reset();
    expect(await getNotificationSubscriptionForUser("user-1", "form-1")).toBe(
      false,
    );

    existingSubscription = { formId: "form-1" };
    expect(await getNotificationSubscriptionForUser("user-1", "form-1")).toBe(
      true,
    );
  });
});

describe("listNotificationRecipients", () => {
  test("leaves out subscribers without a notification email", async () => {
    reset();
    subscribers = [
      {
        user: {
          id: "user-1",
          notificationEmail: "ada@example.com",
          locale: "en",
        },
      },
      { user: { id: "user-2", notificationEmail: null, locale: "ru" } },
      {
        user: {
          id: "user-3",
          notificationEmail: "boris@example.ru",
          locale: null,
        },
      },
    ];

    const recipients = await listNotificationRecipients("form-1");

    expect(recipients.length).toBe(2);
    expect(recipients[0].notificationEmail).toBe("ada@example.com");
    expect(recipients[1].id).toBe("user-3");
    expect(recipients[1].locale).toBe(null);
    expect(JSON.stringify(calls[0].args.where)).toBe('{"formId":"form-1"}');
  });
});
