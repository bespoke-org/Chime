"use client";

import { useTransition } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();

  return (
    <Button
      size="lg"
      onClick={() =>
        startTransition(() => {
          void signIn("google", { callbackUrl: "/dashboard" });
        })
      }
    >
      {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
      {t("auth.continueWithGoogle")}
    </Button>
  );
}
