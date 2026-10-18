"use client";

import { useState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { SignInProviderOption } from "@/lib/oidc-auth";

export function ProviderSignInButtons({
  providers,
}: {
  providers: SignInProviderOption[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { t } = useI18n();

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {providers.map((provider) => (
        <Button
          key={provider.id}
          size="lg"
          variant="secondary"
          type="button"
          className="w-full"
          disabled={pendingId !== null}
          onClick={() => {
            setPendingId(provider.id);
            void signIn(provider.id, { callbackUrl: "/dashboard" });
          }}
        >
          {pendingId === provider.id ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <LogIn className="size-4" />
          )}
          {t("auth.continueWith", { name: provider.label })}
        </Button>
      ))}
      <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--line-strong)]" />
        {t("auth.providerDivider")}
        <span className="h-px flex-1 bg-[var(--line-strong)]" />
      </div>
    </div>
  );
}
