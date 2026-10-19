import { describe, expect, test } from "bun:test";

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
  updatedAt: Date;
};

// The form the access check finds; null means the user cannot see it.
let accessibleFormId: string | null = "form-1";
// The membership role of each user in org-1; a missing user is no member.
let roles: Record<string, "OWNER" | "MEMBER"> = {};
let rows: WebhookRow[] = [];
let nextId = 1;
// Titles of the other forms the user can open; a form missing here is out of
// reach for the reusable list.
let otherForms: Record<string, string> = {};

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

// Every key of a where clause must equal the row's value.
function matches(row: WebhookRow, where: Record<string, unknown>) {
  return Object.entries(where).every(
    ([key, value]) => (row as Record<string, unknown>)[key] === value,
  );
}

mock.module("@/lib/db", () => ({
  db: {
    organizationMembership: {
      findUnique: async (args: {
        where: {
          organizationId_userId: { organizationId: string; userId: string };
        };
      }) => {
        const { organizationId, userId } = args.where.organizationId_userId;
        const role = organizationId === "org-1" ? roles[userId] : undefined;
        return role ? { organizationId, userId, role } : null;
      },
    },
    form: {
      findFirst: async (args: { where: { id: string } }) =>
        args.where.id === accessibleFormId ? { id: args.where.id } : null,
    },
    formWebhook: {
      count: async (args: { where: Record<string, unknown> }) =>
        rows.filter((row) => matches(row, args.where)).length,
      findMany: async (args: { where: Record<string, unknown> }) => {
        // The reusable list asks for webhooks of other accessible forms.
        if ("form" in args.where) {
          const { not } = args.where.formId as { not: string };
          return rows
            .filter((row) => row.formId !== not && row.formId! in otherForms)
            .reverse()
            .map((row) => ({
              ...row,
              form: { title: otherForms[row.formId!] },
            }));
        }
        return rows.filter((row) => matches(row, args.where));
      },
      findFirst: async (args: { where: Record<string, unknown> }) =>
        rows.find((row) => matches(row, args.where)) ?? null,
      create: async (args: {
        data: Omit<
          WebhookRow,
          "id" | "formId" | "lastDigestAt" | "createdAt" | "updatedAt"
        > & { formId?: string };
      }) => {
        const now = new Date("2026-10-19T10:00:00.000Z");
        const row: WebhookRow = {
          formId: null,
          lastDigestAt: null,
          createdAt: now,
          updatedAt: now,
          ...args.data,
          id: `wh-${nextId++}`,
        };
        rows.push(row);
        return row;
      },
      update: async (args: {
        where: { id: string };
        data: Partial<WebhookRow>;
      }) => {
        const row = rows.find((candidate) => candidate.id === args.where.id);
        if (!row) {
          throw new Error("not found");
        }
        Object.assign(row, args.data);
        return row;
      },
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        const before = rows.length;
        rows = rows.filter((row) => !matches(row, args.where));
        return { count: before - rows.length };
      },
    },
  },
}));

const {
  createFormWebhook,
  createOrganizationWebhook,
  deleteFormWebhook,
  deleteOrganizationWebhook,
  listFormWebhooks,
  listOrganizationWebhooks,
  listReusableFormWebhooks,
  normalizeWebhookUrl,
  updateFormWebhook,
  updateOrganizationWebhook,
} = await import("@/lib/form-webhooks");
const { AppError } = await import("@/lib/errors");

function reset() {
  accessibleFormId = "form-1";
  roles = { "owner-1": "OWNER", "member-1": "MEMBER" };
  rows = [];
  nextId = 1;
  otherForms = {};
}

async function statusOf(run: () => Promise<unknown>) {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof AppError ? error.status : "other";
  }
}

const url = "https://hooks.example.com/lively";

describe("form webhooks service", () => {
  test("lists other forms' webhooks to copy, newest first, once each", async () => {
    reset();
    otherForms = { "form-2": "Хакатон", "form-3": "Анкета" };
    await createFormWebhook("user-1", "form-1", { url: `${url}/own` });
    accessibleFormId = "form-2";
    await createFormWebhook("user-1", "form-2", { url, secret: "s3cret" });
    accessibleFormId = "form-3";
    // The same endpoint with another spelling and the same settings.
    await createFormWebhook("user-1", "form-3", {
      url: "https://HOOKS.example.com/lively/",
      secret: "s3cret",
    });
    await createFormWebhook("user-1", "form-3", {
      url,
      secret: "s3cret",
      mode: "DIGEST",
      digestInterval: "HOURLY",
    });
    // A form the user cannot open.
    rows.push({ ...rows[1]!, id: "wh-x", formId: "form-9" });
    accessibleFormId = "form-1";

    const reusable = await listReusableFormWebhooks("user-1", "form-1");

    expect(JSON.stringify(reusable)).toBe(
      JSON.stringify([
        {
          url,
          secret: "s3cret",
          mode: "DIGEST",
          digestInterval: "HOURLY",
          digestTime: null,
          digestWeekday: null,
          formTitle: "Анкета",
        },
        {
          url: "https://HOOKS.example.com/lively/",
          secret: "s3cret",
          mode: "IMMEDIATE",
          digestInterval: null,
          digestTime: null,
          digestWeekday: null,
          formTitle: "Анкета",
        },
      ]),
    );
    accessibleFormId = null;
    expect(
      await statusOf(() => listReusableFormWebhooks("user-1", "form-1")),
    ).toBe(404);
  });

  test("creates a webhook and returns the list with ISO dates", async () => {
    reset();

    const webhooks = await createFormWebhook("user-1", "form-1", {
      url,
      secret: "s3cret",
    });

    expect(webhooks.length).toBe(1);
    expect(JSON.stringify(webhooks[0])).toBe(
      JSON.stringify({
        id: "wh-1",
        url,
        secret: "s3cret",
        enabled: true,
        mode: "IMMEDIATE",
        digestInterval: null,
        digestTime: null,
        digestWeekday: null,
        lastDigestAt: null,
        createdAt: "2026-10-19T10:00:00.000Z",
      }),
    );
  });

  test("rejects a form the user cannot access with 404", async () => {
    reset();
    accessibleFormId = null;

    expect(await statusOf(() => listFormWebhooks("user-1", "form-1"))).toBe(
      404,
    );
    expect(
      await statusOf(() => createFormWebhook("user-1", "form-1", { url })),
    ).toBe(404);
    expect(
      await statusOf(() =>
        updateFormWebhook("user-1", "form-1", "wh-1", { url }),
      ),
    ).toBe(404);
    expect(
      await statusOf(() => deleteFormWebhook("user-1", "form-1", "wh-1")),
    ).toBe(404);
    expect(rows.length).toBe(0);
  });

  test("validates the input before touching the form", async () => {
    reset();

    expect(
      await statusOf(() =>
        createFormWebhook("user-1", "form-1", { url: "http://localhost/x" }),
      ),
    ).toBe("other");
    expect(rows.length).toBe(0);
  });

  test("allows ten webhooks and rejects the eleventh with 422", async () => {
    reset();

    for (let index = 0; index < 10; index += 1) {
      await createFormWebhook("user-1", "form-1", { url: `${url}/${index}` });
    }

    expect(rows.length).toBe(10);
    expect(
      await statusOf(() => createFormWebhook("user-1", "form-1", { url })),
    ).toBe(422);
    expect(rows.length).toBe(10);
  });

  test("updates only a webhook of that form", async () => {
    reset();
    await createFormWebhook("user-1", "form-1", { url });
    rows.push({ ...rows[0], id: "wh-other", formId: "form-2" });

    const webhooks = await updateFormWebhook("user-1", "form-1", "wh-1", {
      url,
      enabled: false,
    });

    expect(webhooks.length).toBe(1);
    expect(webhooks[0].enabled).toBe(false);
    expect(
      await statusOf(() =>
        updateFormWebhook("user-1", "form-1", "wh-other", { url }),
      ),
    ).toBe(404);
  });

  test("a new digest schedule starts its period at the update", async () => {
    reset();
    await createFormWebhook("user-1", "form-1", { url });
    const now = new Date("2026-10-19T12:00:00.000Z");

    const webhooks = await updateFormWebhook(
      "user-1",
      "form-1",
      "wh-1",
      { url, mode: "DIGEST", digestInterval: "DAILY", digestTime: "09:00" },
      now,
    );

    expect(webhooks[0].mode).toBe("DIGEST");
    expect(webhooks[0].digestTime).toBe("09:00");
    expect(webhooks[0].lastDigestAt).toBe("2026-10-19T12:00:00.000Z");

    // Changing only the URL keeps the period.
    const later = new Date("2026-10-19T13:00:00.000Z");
    const unchanged = await updateFormWebhook(
      "user-1",
      "form-1",
      "wh-1",
      {
        url: `${url}/v2`,
        mode: "DIGEST",
        digestInterval: "DAILY",
        digestTime: "09:00",
      },
      later,
    );
    expect(unchanged[0].lastDigestAt).toBe("2026-10-19T12:00:00.000Z");
  });

  test("deletes a webhook and reports a missing one", async () => {
    reset();
    await createFormWebhook("user-1", "form-1", { url });

    const webhooks = await deleteFormWebhook("user-1", "form-1", "wh-1");

    expect(webhooks.length).toBe(0);
    expect(
      await statusOf(() => deleteFormWebhook("user-1", "form-1", "wh-1")),
    ).toBe(404);
  });
});

describe("organization webhooks service", () => {
  test("the owner creates, updates and deletes an organization webhook", async () => {
    reset();

    const created = await createOrganizationWebhook("owner-1", "org-1", {
      url,
    });
    expect(created.length).toBe(1);
    expect(rows[0].organizationId).toBe("org-1");
    expect(rows[0].formId).toBe(null);

    const updated = await updateOrganizationWebhook(
      "owner-1",
      "org-1",
      "wh-1",
      { url, enabled: false },
    );
    expect(updated[0].enabled).toBe(false);

    const listed = await listOrganizationWebhooks("owner-1", "org-1");
    expect(listed.length).toBe(1);

    const deleted = await deleteOrganizationWebhook("owner-1", "org-1", "wh-1");
    expect(deleted.length).toBe(0);
  });

  test("a member gets 403 and a non-member 404 without any change", async () => {
    reset();
    await createOrganizationWebhook("owner-1", "org-1", { url });

    for (const [userId, status] of [
      ["member-1", 403],
      ["stranger", 404],
    ] as const) {
      expect(
        await statusOf(() => listOrganizationWebhooks(userId, "org-1")),
      ).toBe(status);
      expect(
        await statusOf(() =>
          createOrganizationWebhook(userId, "org-1", { url }),
        ),
      ).toBe(status);
      expect(
        await statusOf(() =>
          updateOrganizationWebhook(userId, "org-1", "wh-1", {
            url,
            enabled: false,
          }),
        ),
      ).toBe(status);
      expect(
        await statusOf(() =>
          deleteOrganizationWebhook(userId, "org-1", "wh-1"),
        ),
      ).toBe(status);
    }

    expect(rows.length).toBe(1);
    expect(rows[0].enabled).toBe(true);
  });

  test("allows ten organization webhooks and rejects the eleventh with 422", async () => {
    reset();
    // Form webhooks do not count towards the organization's limit.
    await createFormWebhook("user-1", "form-1", { url });

    for (let index = 0; index < 10; index += 1) {
      await createOrganizationWebhook("owner-1", "org-1", {
        url: `${url}/${index}`,
      });
    }

    expect(
      await statusOf(() =>
        createOrganizationWebhook("owner-1", "org-1", { url }),
      ),
    ).toBe(422);
    expect(rows.length).toBe(11);
  });

  test("form and organization webhooks are not reachable through each other", async () => {
    reset();
    await createFormWebhook("user-1", "form-1", { url });
    await createOrganizationWebhook("owner-1", "org-1", { url });

    expect(
      await statusOf(() =>
        deleteOrganizationWebhook("owner-1", "org-1", "wh-1"),
      ),
    ).toBe(404);
    expect(
      await statusOf(() => deleteFormWebhook("user-1", "form-1", "wh-2")),
    ).toBe(404);
    expect((await listFormWebhooks("user-1", "form-1")).length).toBe(1);
    expect(rows.length).toBe(2);
  });
});

describe("normalizeWebhookUrl", () => {
  test("ignores case of scheme and host, a trailing slash and a fragment", () => {
    expect(normalizeWebhookUrl("HTTPS://Hooks.Example.COM/Lively/")).toBe(
      "https://hooks.example.com/Lively",
    );
    expect(normalizeWebhookUrl("https://hooks.example.com:443/")).toBe(
      "https://hooks.example.com",
    );
    expect(normalizeWebhookUrl("https://hooks.example.com/x#part")).toBe(
      "https://hooks.example.com/x",
    );
  });

  test("keeps the query, the path case and a non-default port", () => {
    expect(normalizeWebhookUrl("https://hooks.example.com/x/?team=a")).toBe(
      "https://hooks.example.com/x?team=a",
    );
    expect(
      normalizeWebhookUrl("https://hooks.example.com/x?team=a") ===
        normalizeWebhookUrl("https://hooks.example.com/x?team=b"),
    ).toBe(false);
    expect(normalizeWebhookUrl("http://hooks.example.com:8080/x")).toBe(
      "http://hooks.example.com:8080/x",
    );
  });
});
