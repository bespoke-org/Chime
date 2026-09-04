import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import {
  getServerSession,
  type NextAuthOptions,
  type Session,
} from "next-auth";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { normalizeLocale } from "@/lib/i18n";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/",
  },
  providers: [],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.firstName = user.firstName ?? null;
        session.user.secondName = user.secondName ?? null;
        session.user.locale = normalizeLocale(user.locale ?? "en");
        session.user.name = user.name ?? null;
        session.user.email = user.email ?? null;
        session.user.image = user.image ?? null;
      }

      return session;
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
