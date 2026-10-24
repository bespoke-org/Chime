import { describe, expect, test } from "bun:test";

type CallbackResult = {
  session: { did: `did:${string}:${string}` };
  state: string;
};

type SessionCreateArgs = {
  data: {
    sessionToken: string;
    userId: string;
    expires: Date;
  };
};

let callbackResult: CallbackResult;
let existingAccountUserId: string | null;
let createdAccounts: Array<{
  data: { userId: string; provider: string; providerAccountId: string };
}>;
let createdSessions: SessionCreateArgs[];
let deletedOAuthSessions: string[];
let profileSyncs: Array<{
  userId: string;
  profile: Record<string, string | undefined>;
}>;

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@atproto/oauth-client-node", () => ({
  NodeOAuthClient: class NodeOAuthClient {
    async callback() {
      return callbackResult;
    }
  },
}));

mock.module("@atproto/api", () => ({
  Agent: class Agent {
    async getProfile() {
      return {
        data: {
          handle: "mona.example.com",
          displayName: "Mona Lisa",
          avatar: "https://example.com/avatar.png",
        },
      };
    }
  },
}));

mock.module("@/lib/users", () => ({
  syncAtprotoProfileFields: async (
    userId: string,
    profile: Record<string, string | undefined>,
  ) => {
    profileSyncs.push({ userId, profile });
  },
}));

const transactionClient = {
  account: {
    findUnique: async () =>
      existingAccountUserId ? { userId: existingAccountUserId } : null,
    create: async (args: {
      data: { userId: string; provider: string; providerAccountId: string };
    }) => {
      createdAccounts.push(args);
    },
  },
  user: {
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
      id: where.id,
    }),
    create: async () => ({ id: "new-user" }),
  },
};

mock.module("@/lib/db", () => ({
  db: {
    atprotoOAuthState: {},
    atprotoOAuthSession: {
      delete: async ({ where }: { where: { sub: string } }) => {
        deletedOAuthSessions.push(where.sub);
      },
    },
    $transaction: async (
      run: (tx: typeof transactionClient) => Promise<unknown>,
    ) => run(transactionClient),
    session: {
      create: async (args: SessionCreateArgs) => {
        createdSessions.push(args);
      },
    },
  },
}));

const { completeAtprotoSignIn } = await import("@/lib/atproto-auth");
const { SignInNotAllowedError } = await import("@/lib/sign-in-allowlist");

function resetTestState(callbackUrl = "/dashboard") {
  callbackResult = {
    session: { did: "did:plc:123" },
    state: Buffer.from(JSON.stringify({ callbackUrl })).toString("base64url"),
  };
  existingAccountUserId = "existing-user";
  createdAccounts = [];
  createdSessions = [];
  deletedOAuthSessions = [];
  profileSyncs = [];
}

describe("completeAtprotoSignIn", () => {
  test("reuses the DID account and creates an app session", async () => {
    resetTestState("/forms/new");

    const result = await completeAtprotoSignIn(new URLSearchParams("code=ok"));

    expect(result.callbackUrl).toBe("/forms/new");
    expect(result.sessionToken.length).toBe(64);
    expect(createdSessions.length).toBe(1);
    expect(createdSessions[0]?.data.userId).toBe("existing-user");
    expect(deletedOAuthSessions[0]).toBe("did:plc:123");
    expect(profileSyncs[0]?.userId).toBe("existing-user");
    expect(profileSyncs[0]?.profile.handle).toBe("mona.example.com");
  });

  test("falls back to the dashboard for an unsafe callback", async () => {
    resetTestState("/\\evil.example/path");

    const result = await completeAtprotoSignIn(new URLSearchParams("code=ok"));

    expect(result.callbackUrl).toBe("/dashboard");
  });

  test("refuses a handle outside the allowlist before touching the user", async () => {
    resetTestState();
    process.env.ALLOWED_SIGNIN_IDENTIFIERS = "other.example.org";

    let thrown: unknown = null;

    try {
      await completeAtprotoSignIn(new URLSearchParams("code=ok"));
    } catch (error) {
      thrown = error;
    } finally {
      delete process.env.ALLOWED_SIGNIN_IDENTIFIERS;
    }

    expect(thrown instanceof SignInNotAllowedError).toBe(true);

    expect(createdSessions.length).toBe(0);
    expect(profileSyncs.length).toBe(0);
    expect(deletedOAuthSessions[0]).toBe("did:plc:123");
  });

  test("creates an ATProto account for a new DID", async () => {
    resetTestState();
    existingAccountUserId = null;

    await completeAtprotoSignIn(new URLSearchParams("code=ok"));

    expect(createdAccounts.length).toBe(1);
    expect(createdAccounts[0]?.data.userId).toBe("new-user");
    expect(createdAccounts[0]?.data.provider).toBe("atproto");
    expect(createdAccounts[0]?.data.providerAccountId).toBe("did:plc:123");
    expect(createdSessions[0]?.data.userId).toBe("new-user");
  });
});
