import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      firstName: string | null;
      secondName: string | null;
      locale: "en" | "ru" | null;
    };
  }

  interface User {
    id: string;
    firstName: string | null;
    secondName: string | null;
    locale: "en" | "ru" | null;
  }
}
