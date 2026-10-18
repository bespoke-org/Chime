import { describe, expect, test } from "bun:test";

type Call = { method: string; args: Record<string, unknown> };

let calls: Call[] = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    organizationMembership: {
      findUnique: async (args: {
        where: { organizationId_userId: { userId: string } };
      }) => ({
        organizationId: "org-1",
        userId: args.where.organizationId_userId.userId,
        role:
          args.where.organizationId_userId.userId === "owner-1"
            ? "OWNER"
            : "MEMBER",
        organization: { id: "org-1", name: "Org" },
      }),
      delete: (args: Record<string, unknown>) => ({
        method: "membership.delete",
        args,
      }),
    },
    formNotificationSubscription: {
      deleteMany: (args: Record<string, unknown>) => ({
        method: "subscription.deleteMany",
        args,
      }),
    },
    $transaction: async (operations: Call[]) => {
      calls.push(...operations);
      return operations.map(() => ({}));
    },
  },
}));

const { removeOrganizationMember } = await import("@/lib/organizations");

describe("removeOrganizationMember", () => {
  test("drops the member's subscriptions on the organization's forms with the membership", async () => {
    calls = [];

    await removeOrganizationMember("owner-1", "org-1", "member-1");

    expect(calls.length).toBe(2);
    expect(calls[0].method).toBe("subscription.deleteMany");
    expect(JSON.stringify(calls[0].args.where)).toBe(
      '{"userId":"member-1","form":{"organizationId":"org-1"}}',
    );
    expect(calls[1].method).toBe("membership.delete");
    expect(JSON.stringify(calls[1].args.where)).toContain(
      '"userId":"member-1"',
    );
  });
});
