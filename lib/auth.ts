import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import {
  getServerSession,
  type NextAuthOptions,
  type Session,
} from "next-auth";
import type { Provider } from "next-auth/providers/index";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { normalizeLocale } from "@/lib/i18n";
import {
  getExternalProfile,
  getGithubConfig,
  getGoogleConfig,
  getOidcConfig,
  mapOidcProfile,
  pickAccountColumns,
} from "@/lib/oidc-auth";
import { syncExternalProfileFields } from "@/lib/users";

function getProviders(env: NodeJS.ProcessEnv): Provider[] {
  const providers: Provider[] = [];
  const google = getGoogleConfig(env);
  const github = getGithubConfig(env);
  const oidc = getOidcConfig(env);

  if (google) {
    providers.push(GoogleProvider(google));
  }

  if (github) {
    providers.push(GitHubProvider(github));
  }

  if (oidc) {
    providers.push({
      id: "oidc",
      name: oidc.name,
      type: "oauth",
      wellKnown: `${oidc.issuer}/.well-known/openid-configuration`,
      clientId: oidc.clientId,
      clientSecret: oidc.clientSecret,
      idToken: true,
      checks: ["pkce", "state"],
      authorization: { params: { scope: oidc.scope } },
      profile: (profile) => ({
        ...mapOidcProfile(profile),
        firstName: null,
        secondName: null,
        locale: null,
      }),
    });
  }

  return providers;
}

function createAdapter(): Adapter {
  const adapter = PrismaAdapter(db) as Adapter;
  const linkAccount = adapter.linkAccount?.bind(adapter);

  if (!linkAccount) {
    return adapter;
  }

  // next-auth and @auth/core ship two AdapterAccount types that only differ
  // nominally, so the wrapper is cast as a whole.
  const filteringLinkAccount = ((account: AdapterAccount) =>
    linkAccount(
      pickAccountColumns(account) as never,
    )) as Adapter["linkAccount"];

  return {
    ...adapter,
    linkAccount: filteringLinkAccount,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: createAdapter(),
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/",
  },
  providers: getProviders(process.env),
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.firstName = user.firstName ?? null;
        session.user.secondName = user.secondName ?? null;
        session.user.locale = user.locale ? normalizeLocale(user.locale) : null;
        session.user.name = user.name ?? null;
        session.user.email = user.email ?? null;
        session.user.image = user.image ?? null;
      }

      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (!account || !user.id) {
        return;
      }

      await syncExternalProfileFields(
        user.id,
        getExternalProfile(account.provider, profile),
      );
    },
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}

type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]> & {
    id: string;
  };
};

export async function requireServerAuthSession(redirectTo = "/") {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect(redirectTo);
  }

  return session as AuthenticatedSession;
}

export async function requireServerSessionUser(redirectTo = "/") {
  return (await requireServerAuthSession(redirectTo)).user;
}

export async function requireServerSessionUserId(redirectTo = "/") {
  return (await requireServerSessionUser(redirectTo)).id;
}
