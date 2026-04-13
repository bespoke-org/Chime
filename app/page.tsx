import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function HomePage() {
  const session = await getServerAuthSession();
  const { t } = await getRequestI18n();
  const appName = t("app.name");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8 lg:px-10 lg:py-10">
      <section className="flex flex-1 items-center justify-center py-16 lg:py-24">
        <Card className="w-full max-w-3xl p-8 lg:p-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4">
              <Image
                src="/sproute.png"
                alt={appName}
                width={72}
                height={72}
                priority
                className="size-18"
              />
              <h1 className="font-display text-5xl leading-none text-[var(--ink)] sm:text-6xl">
                {appName}
              </h1>
            </div>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              {t("home.description")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {session?.user ? (
                <Link href="/dashboard">
                  <Button size="lg">
                    {t("home.openDashboard")}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              ) : (
                <GoogleSignInButton />
              )}
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
