import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { db } from "@/lib/db";
import { normalizeLocale } from "@/lib/i18n";
import { syncGoogleProfileFields } from "@/lib/users";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
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
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.id) {
        return;
      }

      await syncGoogleProfileFields(user.id, {
        name: typeof profile?.name === "string" ? profile.name : null,
        given_name:
          profile && typeof (profile as { given_name?: unknown }).given_name === "string"
            ? ((profile as { given_name?: string }).given_name ?? null)
            : null,
        family_name:
          profile && typeof (profile as { family_name?: unknown }).family_name === "string"
            ? ((profile as { family_name?: string }).family_name ?? null)
            : null,
        picture:
          profile && typeof (profile as { picture?: unknown }).picture === "string"
            ? ((profile as { picture?: string }).picture ?? null)
            : null,
        locale:
          profile && typeof (profile as { locale?: unknown }).locale === "string"
            ? normalizeLocale((profile as { locale?: string }).locale ?? null)
            : null,
      });
    },
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
