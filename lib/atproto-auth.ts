import { Agent } from "@atproto/api";
import {
  NodeOAuthClient,
  type OAuthClientOptions,
  type NodeSavedSession,
  type NodeSavedState,
  type NodeSavedSessionStore,
  type NodeSavedStateStore,
} from "@atproto/oauth-client-node";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";

import {
  createTimeoutFetch,
  getAtprotoPublicBaseUrl,
  getSafeAtprotoCallbackUrl,
} from "@/lib/atproto-auth-utils";
import { db } from "@/lib/db";
import {
  isSignInAllowed,
  parseAllowedSignInIdentifiers,
  SignInNotAllowedError,
} from "@/lib/sign-in-allowlist";
import { syncAtprotoProfileFields } from "@/lib/users";

export {
  createTimeoutFetch,
  getAtprotoPublicBaseUrl,
  getSafeAtprotoCallbackUrl,
} from "@/lib/atproto-auth-utils";

const ATPROTO_PROVIDER = "atproto";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_AUTHORIZATION_TIMEOUT_MS = 15_000;

type AtprotoOAuthStateValue = NodeSavedState & Prisma.JsonObject;
type AtprotoOAuthSessionValue = NodeSavedSession & Prisma.JsonObject;

type AtprotoStatePayload = {
  callbackUrl?: string;
};

export function getAtprotoAuthConfig() {
  const baseUrl = getAtprotoPublicBaseUrl();
  const redirectUri =
    process.env.ATPROTO_REDIRECT_URI ?? `${baseUrl}/api/auth/atproto/callback`;
  const scope = process.env.ATPROTO_SCOPE ?? "atproto transition:generic";
  const defaultClientId = baseUrl.startsWith("http://")
    ? `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`
    : `${baseUrl}/api/atproto/client-metadata`;
  const clientId = process.env.ATPROTO_CLIENT_ID ?? defaultClientId;

  return {
    baseUrl,
    clientId,
    redirectUri,
    clientName: process.env.ATPROTO_CLIENT_NAME ?? "Chime",
    scope,
  };
}

export function getAtprotoClientMetadata() {
  const config = getAtprotoAuthConfig();

  return {
    client_id: config.clientId,
    client_name: config.clientName,
    client_uri: config.baseUrl,
    redirect_uris: [config.redirectUri],
    scope: config.scope,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true,
  } as unknown as OAuthClientOptions["clientMetadata"];
}

const stateStore: NodeSavedStateStore = {
  async set(key, value) {
    const now = new Date();

    await db.$transaction([
      db.atprotoOAuthState.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      db.atprotoOAuthState.upsert({
        where: { key },
        create: {
          key,
          value: value as AtprotoOAuthStateValue,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
        update: {
          value: value as AtprotoOAuthStateValue,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
      }),
    ]);
  },
  async get(key) {
    const state = await db.atprotoOAuthState.findUnique({ where: { key } });

    if (!state || state.expiresAt < new Date()) {
      if (state) {
        await db.atprotoOAuthState.delete({ where: { key } }).catch(() => {});
      }
      return undefined;
    }

    return state.value as NodeSavedState;
  },
  async del(key) {
    await db.atprotoOAuthState.delete({ where: { key } }).catch(() => {});
  },
};

const sessionStore: NodeSavedSessionStore = {
  async set(sub, value) {
    await db.atprotoOAuthSession.upsert({
      where: { sub },
      create: {
        sub,
        value: value as AtprotoOAuthSessionValue,
      },
      update: {
        value: value as AtprotoOAuthSessionValue,
      },
    });
  },
  async get(sub) {
    const session = await db.atprotoOAuthSession.findUnique({ where: { sub } });
    return session?.value as NodeSavedSession | undefined;
  },
  async del(sub) {
    await db.atprotoOAuthSession.delete({ where: { sub } }).catch(() => {});
  },
};

const oauthFetch = createTimeoutFetch(globalThis.fetch);

let atprotoOAuthClient: NodeOAuthClient | null = null;

export function getAtprotoOAuthClient() {
  atprotoOAuthClient ??= new NodeOAuthClient({
    clientMetadata: getAtprotoClientMetadata(),
    stateStore,
    sessionStore,
    requestLock: async (_key, run) => run(),
    fetch: oauthFetch,
  });

  return atprotoOAuthClient;
}

export function normalizeAtprotoIdentifier(identifier: string) {
  return identifier.trim().replace(/^@/, "");
}

export async function getAtprotoAuthorizationUrl(
  identifier: string,
  options: { callbackUrl?: string } = {},
) {
  const cleanIdentifier = normalizeAtprotoIdentifier(identifier);

  if (!cleanIdentifier) {
    throw new Error("ATProto identity is required.");
  }

  const state = Buffer.from(
    JSON.stringify({
      callbackUrl: options.callbackUrl,
    } satisfies AtprotoStatePayload),
  ).toString("base64url");

  return getAtprotoOAuthClient().authorize(cleanIdentifier, {
    state,
    signal: AbortSignal.timeout(OAUTH_AUTHORIZATION_TIMEOUT_MS),
  });
}

function parseAtprotoState(state: string | null): AtprotoStatePayload {
  if (!state) {
    return {};
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function getAtprotoRedirectUrl(path: string) {
  return new URL(getSafeAtprotoCallbackUrl(path), getAtprotoPublicBaseUrl());
}

function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function getNextAuthSessionCookieName() {
  const url = process.env.NEXTAUTH_URL ?? process.env.ATPROTO_PUBLIC_URL ?? "";
  const secure =
    url.startsWith("https://") || process.env.NODE_ENV === "production";
  return secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export async function completeAtprotoSignIn(params: URLSearchParams) {
  const { session, state } = await getAtprotoOAuthClient().callback(params, {
    redirect_uri: getAtprotoAuthConfig().redirectUri as never,
  });
  const did = session.did;
  const callbackUrl = getSafeAtprotoCallbackUrl(
    parseAtprotoState(state).callbackUrl,
  );

  const agent = new Agent(session);
  const profile = await agent.getProfile({ actor: did }).catch(() => null);
  const profileData = profile?.data;
  const handle = profileData?.handle ?? did;
  const displayName = profileData?.displayName ?? null;
  const avatar = profileData?.avatar ?? null;

  if (!isSignInAllowed({ did, handle }, parseAllowedSignInIdentifiers())) {
    await sessionStore.del(did);
    throw new SignInNotAllowedError();
  }

  const user = await db.$transaction(async (tx) => {
    const existingAccount = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: ATPROTO_PROVIDER,
          providerAccountId: did,
        },
      },
      select: { userId: true },
    });

    if (existingAccount) {
      return tx.user.findUniqueOrThrow({
        where: { id: existingAccount.userId },
      });
    }

    const nextUser = await tx.user.create({ data: {} });

    await tx.account.create({
      data: {
        userId: nextUser.id,
        type: "oauth",
        provider: ATPROTO_PROVIDER,
        providerAccountId: did,
        token_type: "DPoP",
        scope: getAtprotoAuthConfig().scope,
      },
    });

    return nextUser;
  });

  await syncAtprotoProfileFields(user.id, {
    did,
    handle,
    displayName,
    avatar,
  });
  await sessionStore.del(did);

  const expires = new Date(Date.now() + DEFAULT_SESSION_MAX_AGE_SECONDS * 1000);
  const sessionToken = createSessionToken();

  await db.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  return {
    callbackUrl,
    sessionToken,
    expires,
  };
}
