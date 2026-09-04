import Link from "next/link";
import { ArrowRight, Sprout } from "lucide-react";

import { AuthErrorAlert } from "@/components/auth/auth-error-alert";
import { AtprotoSignInForm } from "@/components/auth/atproto-sign-in-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ authError?: string }>;
}) {
  const session = await getServerAuthSession();
  const { t } = await getRequestI18n();
  const params = await searchParams;
  const authError = params?.authError;
  const appName = t("app.name");

  return (
    <main className="flex w-full flex-1 items-center justify-center px-5 py-12 sm:px-8">
      <section className="w-full max-w-lg">
        <Card className="w-full bg-[var(--surface-strong)] p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)]">
              <Sprout className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl text-[var(--ink)]">
              {appName}
            </span>
          </div>

          <div className="mt-9">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
              {session?.user ? t("home.welcomeBack") : t("auth.title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
              {session?.user
                ? t("home.signedInDescription")
                : t("auth.description")}
            </p>

            <div className="mt-7">
              {session?.user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="w-full">
                    {t("home.openDashboard")}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-4">
                  {authError ? (
                    <AuthErrorAlert message={t("auth.atprotoError")} />
                  ) : null}
                  <AtprotoSignInForm />
                </div>
              )}
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
