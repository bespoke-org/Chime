import { describe, expect, test } from "bun:test";

let sessionUserId: string | null = null;
let created: Array<Record<string, unknown>> = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/auth", () => ({
  getServerAuthSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : null,
}));

mock.module("@/lib/db", () => ({
  db: {
    organizationMembership: {
      findUnique: async (args: {
        where: { organizationId_userId: { userId: string } };
      }) => {
        const { userId } = args.where.organizationId_userId;
        if (userId === "stranger") {
          return null;
        }
        return {
          organizationId: "org-1",
          userId,
          role: userId === "owner-1" ? "OWNER" : "MEMBER",
        };
      },
    },
    formWebhook: {
      findMany: async () => [],
      count: async () => 0,
      create: async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return args.data;
      },
      deleteMany: async () => ({ count: 0 }),
    },
  },
}));

const collection =
  await import("@/app/api/organizations/[organizationId]/webhooks/route");
const single =
  await import("@/app/api/organizations/[organizationId]/webhooks/[webhookId]/route");

const collectionContext = {
  params: Promise.resolve({ organizationId: "org-1" }),
};
const singleContext = {
  params: Promise.resolve({ organizationId: "org-1", webhookId: "wh-1" }),
};

function postRequest() {
  return new Request("http://localhost/api/organizations/org-1/webhooks", {
    method: "POST",
    body: JSON.stringify({ url: "https://hooks.example.com/lively" }),
  });
}

async function statuses() {
  return [
    (await collection.GET(new Request("http://localhost"), collectionContext))
      .status,
    (await collection.POST(postRequest(), collectionContext)).status,
    (await single.PATCH(postRequest(), singleContext)).status,
    (await single.DELETE(new Request("http://localhost"), singleContext))
      .status,
  ].join(",");
}

describe("organization webhook routes", () => {
  test("answer 401 without a session", async () => {
    sessionUserId = null;
    created = [];

    expect(await statuses()).toBe("401,401,401,401");
    expect(created.length).toBe(0);
  });

  test("answer 403 to a member and 404 to a non-member", async () => {
    created = [];

    sessionUserId = "member-1";
    expect(await statuses()).toBe("403,403,403,403");
    sessionUserId = "stranger";
    expect(await statuses()).toBe("404,404,404,404");
    expect(created.length).toBe(0);
  });

  test("let the owner list and create", async () => {
    sessionUserId = "owner-1";
    created = [];

    const list = await collection.GET(
      new Request("http://localhost"),
      collectionContext,
    );
    expect(list.status).toBe(200);
    expect(JSON.stringify(await list.json())).toBe('{"webhooks":[]}');

    const post = await collection.POST(postRequest(), collectionContext);
    expect(post.status).toBe(201);
    expect(created.length).toBe(1);
    expect(created[0].organizationId).toBe("org-1");
  });
});
