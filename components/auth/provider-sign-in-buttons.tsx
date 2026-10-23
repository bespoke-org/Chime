"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";

import { ProviderIcon } from "@/components/auth/provider-icons";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { SignInProviderOption } from "@/lib/oidc-auth";

// Shared by every sign-in button. The label is centered as if there were no
// icon; the icon is anchored at a fixed offset from the center, so icons line
// up across buttons and sit just left of the longest label.
export const signInButtonLayoutClassName = "relative w-full";
export const signInContentClassName = "contents";
export const signInIconSlotClassName =
  "absolute left-[calc(50%-7.5rem)] top-1/2 flex w-7 -translate-y-1/2 items-center justify-center";

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
          className={signInButtonLayoutClassName}
          disabled={pendingId !== null}
          onClick={() => {
            setPendingId(provider.id);
            void signIn(provider.id, { callbackUrl: "/dashboard" });
          }}
        >
          <span className={signInContentClassName}>
            <span className={signInIconSlotClassName}>
              {pendingId === provider.id ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <ProviderIcon
                  providerId={provider.id}
                  iconUrl={provider.iconUrl}
                  // A detailed emblem needs more room than a flat mark.
                  className={provider.iconUrl ? "-my-1 size-7" : "size-5"}
                />
              )}
            </span>
            <span>{t("auth.continueWith", { name: provider.label })}</span>
          </span>
        </Button>
      ))}
    </div>
  );
}
