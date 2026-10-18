"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useState } from "react";

import { updateProfileAction } from "@/app/(creator)/actions";
import { useI18n } from "@/components/i18n-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supportedLocales } from "@/lib/i18n";
import type { ProfileSettingsUserSummary } from "@/lib/form-types";
import { useRouter } from "next/navigation";

export function ProfileSettingsPanel({
  user,
  initialOrganizationId,
}: {
  user: ProfileSettingsUserSummary;
  initialOrganizationId: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [locale, setLocale] = useState(user.locale);
  const [isPending, setIsPending] = useState(false);

  async function submitProfile(formData: FormData) {
    setIsPending(true);

    try {
      await updateProfileAction(formData);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("settings.profile.title")}
        description={t("settings.profile.description")}
        descriptionClassName="max-w-2xl"
        className="border-b-0 pb-0"
      />

      <form action={submitProfile} className="mt-8 space-y-8">
        <input type="hidden" name="returnSection" value="profile" />
        <input
          type="hidden"
          name="returnOrganizationId"
          value={initialOrganizationId ?? ""}
        />
        <input type="hidden" name="locale" value={locale} />

        <div className="flex flex-col gap-4 border-t border-[color:var(--line)] pt-8 sm:flex-row sm:items-center">
          <UserAvatar
            user={user}
            className="size-18"
            initialsClassName="text-lg"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--ink)]">
              {t("settings.profile.profilePicture")}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              {t("settings.profile.profilePictureDescription")}
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("settings.profile.firstName")}
            </span>
            <Input
              name="firstName"
              defaultValue={user.firstName ?? ""}
              placeholder={t("settings.profile.firstName")}
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("settings.profile.secondName")}
            </span>
            <Input
              name="secondName"
              defaultValue={user.secondName ?? ""}
              placeholder={t("settings.profile.secondName")}
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            {t("settings.profile.imageUrl")}
          </span>
          <Input
            name="image"
            type="url"
            defaultValue={user.image ?? ""}
            placeholder="https://example.com/avatar.jpg"
          />
          <span className="text-xs text-[var(--muted)]">
            {t("settings.profile.imageUrlHelp")}
          </span>
        </label>

        <label className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            {t("settings.profile.notificationEmail")}
          </span>
          <Input
            name="notificationEmail"
            type="email"
            autoComplete="email"
            defaultValue={user.notificationEmail ?? ""}
            placeholder="you@example.com"
          />
          <span className="text-xs text-[var(--muted)]">
            {t("settings.profile.notificationEmailHelp")}
          </span>
        </label>

        <div className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            {t("settings.profile.locale")}
          </span>
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as typeof user.locale)}
          >
            <SelectTrigger className="h-11 px-4 text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLocales.map((localeOption) => (
                <SelectItem key={localeOption} value={localeOption}>
                  {t(`settings.profile.localeOptions.${localeOption}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-[var(--muted)]">
            {t("settings.profile.localeHelp")}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t("settings.profile.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
