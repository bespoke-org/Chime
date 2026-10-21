import { Sprout } from "lucide-react";
import { redirect } from "next/navigation";

import { AuthErrorAlert } from "@/components/auth/auth-error-alert";
import { AtprotoSignInForm } from "@/components/auth/atproto-sign-in-form";
import { ProviderSignInButtons } from "@/components/auth/provider-sign-in-buttons";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { getRequestI18n } from "@/lib/i18n-server";
import { getSignInProviderOptions } from "@/lib/oidc-auth";

function getAuthErrorKey(authError?: string, oauthError?: string) {
  if (authError) {
    return "auth.atprotoError";
  }

  if (oauthError === "OAuthAccountNotLinked") {
    return "auth.oauthAccountNotLinked";
  }

  return oauthError ? "auth.oauthError" : null;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ authError?: string; error?: string }>;
}) {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  const { t } = await getRequestI18n();
  const params = await searchParams;
  const authErrorKey = getAuthErrorKey(params?.authError, params?.error);
  const providers = getSignInProviderOptions(process.env);
  const appName = t("app.name");

  return (
    <main className="flex w-full flex-1 items-center justify-center px-5 py-12 sm:px-8">
      <section className="w-full max-w-lg">
        <Card className="w-full bg-[var(--surface-strong)] p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-ink)]">
              <Sprout className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl text-[var(--ink)]">
              {appName}
            </span>
          </div>

          <div className="mt-9">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
              {t("auth.title")}
            </h1>

            <div className="mt-7 flex flex-col gap-4">
              {authErrorKey ? (
                <AuthErrorAlert message={t(authErrorKey)} />
              ) : null}
              <ProviderSignInButtons providers={providers} />
              <AtprotoSignInForm />
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
