"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import {
  signInButtonLayoutClassName,
  signInContentClassName,
  signInIconSlotClassName,
} from "@/components/auth/provider-sign-in-buttons";
import { Button } from "@/components/ui/button";

export function AtprotoSignInForm() {
  const [isPending, setIsPending] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const { t } = useI18n();

  return (
    <form
      action="/api/auth/atproto/start"
      method="post"
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        if (!identifier.trim()) {
          event.preventDefault();
          return;
        }

        setIsPending(true);
      }}
    >
      <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--ink)]">
        {t("auth.atprotoIdentifierLabel")}
        <input
          name="identifier"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder={t("auth.atprotoIdentifierPlaceholder")}
          autoComplete="username"
          spellCheck={false}
          className="h-12 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-base font-normal text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)]/60 hover:border-[var(--muted)]/40 focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent)]/15"
          required
        />
      </label>
      <input type="hidden" name="callbackUrl" value="/dashboard" />
      <Button
        size="lg"
        type="submit"
        disabled={isPending}
        className={signInButtonLayoutClassName}
      >
        <span className={signInContentClassName}>
          <span className={signInIconSlotClassName}>
            {isPending ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <ArrowRight className="size-5" />
            )}
          </span>
          <span>{t("auth.continueWithAtproto")}</span>
        </span>
      </Button>
      <p className="text-center text-xs leading-5 text-[var(--muted)] sm:text-sm">
        {t("auth.atprotoHelp")}
      </p>
    </form>
  );
}
