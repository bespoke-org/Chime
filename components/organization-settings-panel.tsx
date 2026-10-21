"use client";

import { Link2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  createOrganizationAction,
  createOrganizationInviteLinkAction,
  removeOrganizationMemberAction,
  renameOrganizationAction,
  revokeOrganizationInviteLinkAction,
} from "@/app/(creator)/actions";
import { DeleteOrganizationButton } from "@/components/delete-organization-button";
import { useLocalToasts } from "@/components/use-local-toasts";
import { ManagedWebhooksSection } from "@/components/webhooks-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastViewport } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { UserAvatar } from "@/components/user-avatar";
import type { OrganizationSettingsSummary } from "@/lib/form-types";
import { getUserDisplayName } from "@/lib/user-identity";
import { formatDate } from "@/lib/utils";

export function OrganizationSettingsPanel({
  organizations,
  initialOrganizationId,
  digestTimezone,
}: {
  organizations: OrganizationSettingsSummary[];
  initialOrganizationId: string | null;
  digestTimezone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(initialOrganizationId ?? organizations[0]?.id ?? null);
  const { toasts, showToast, dismissToast } = useLocalToasts();
  const selectedOrganization = useMemo(
    () =>
      organizations.find(
        (organization) => organization.id === selectedOrganizationId,
      ) ??
      organizations[0] ??
      null,
    [organizations, selectedOrganizationId],
  );

  async function copyInviteLink(token: string) {
    try {
      const url = `${window.location.origin}/join/${token}`;
      await navigator.clipboard.writeText(url);
      showToast(t("settings.organizations.copyInviteSuccess"));
    } catch {
      showToast(t("settings.organizations.copyInviteError"), "error");
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <div>
        <PageHeader
          title={t("settings.organizations.title")}
          description={t("settings.organizations.description")}
          className="border-b-0 pb-0"
        />

        <div className="mt-8 border-t border-[color:var(--line)] pt-8">
          <form
            action={createOrganizationAction}
            className="flex flex-col gap-3 lg:flex-row lg:items-end"
          >
            <input
              type="hidden"
              name="returnOrganizationId"
              value={selectedOrganizationId ?? ""}
            />
            <label className="grid flex-1 gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("settings.organizations.newOrganizationName")}
              </span>
              <Input
                name="name"
                placeholder={t(
                  "settings.organizations.newOrganizationPlaceholder",
                )}
              />
            </label>
            <Button type="submit">
              {t("settings.organizations.createOrganization")}
            </Button>
          </form>
        </div>

        <div className="mt-8 space-y-5">
          {organizations.length === 0 ? (
            <div className="border-t border-[color:var(--line)] py-6 text-sm text-[var(--muted)]">
              {t("settings.organizations.noneYet")}
            </div>
          ) : null}

          {selectedOrganization ? (
            <>
              <div className="max-w-md border-t border-[color:var(--line)] pt-8">
                <h3 className="text-base font-semibold text-[var(--ink)]">
                  {t("settings.organizations.organizationLabel")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {t("settings.organizations.selectedOrgHelp")}
                </p>
                <div className="mt-3">
                  <Select
                    value={selectedOrganization.id}
                    onValueChange={(value) => {
                      setSelectedOrganizationId(value);

                      const nextParams = new URLSearchParams(
                        searchParams.toString(),
                      );
                      nextParams.set("organization", value);
                      router.replace(`${pathname}?${nextParams.toString()}`, {
                        scroll: false,
                      });
                    }}
                  >
                    <SelectTrigger className="min-w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((organization) => (
                        <SelectItem
                          key={organization.id}
                          value={organization.id}
                        >
                          {organization.name}
                          {organization.isOwner
                            ? ` · ${t("settings.organizations.owner")}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t border-[color:var(--line)] pt-8">
                <div className="border-b border-[color:var(--line)] pb-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl text-[var(--ink)]">
                      {selectedOrganization.name}
                    </h2>
                    <Badge className="rounded-full">
                      {selectedOrganization.isOwner
                        ? t("settings.organizations.owner")
                        : t("settings.organizations.member")}
                    </Badge>
                  </div>

                  {selectedOrganization.isOwner ? (
                    <form
                      key={selectedOrganization.id}
                      action={renameOrganizationAction}
                      className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center"
                    >
                      <input
                        type="hidden"
                        name="organizationId"
                        value={selectedOrganization.id}
                      />
                      <input
                        type="hidden"
                        name="returnOrganizationId"
                        value={selectedOrganization.id}
                      />
                      <div className="flex-1">
                        <Input
                          name="name"
                          defaultValue={selectedOrganization.name}
                        />
                      </div>
                      <Button type="submit" variant="secondary">
                        {t("settings.organizations.renameOrganization")}
                      </Button>
                    </form>
                  ) : null}
                </div>

                <div className="mt-6 space-y-8">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--ink)]">
                      {t("settings.organizations.members")}
                    </h3>
                    <div className="mt-4 space-y-4">
                      {selectedOrganization.members.map((member) => (
                        <div
                          key={member.userId}
                          className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <UserAvatar
                              user={member}
                              className="size-9"
                              initialsClassName="text-[11px]"
                            />
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                              <p className="font-medium text-[var(--ink)]">
                                {getUserDisplayName(member)}
                              </p>
                              {member.email ? (
                                <p className="text-sm text-[var(--muted)]">
                                  {member.email}
                                </p>
                              ) : null}
                              <Badge className="rounded-full">
                                {member.role === "OWNER"
                                  ? t("settings.organizations.owner")
                                  : t("settings.organizations.member")}
                              </Badge>
                            </div>
                          </div>
                          {selectedOrganization.isOwner &&
                          member.role !== "OWNER" ? (
                            <form action={removeOrganizationMemberAction}>
                              <input
                                type="hidden"
                                name="organizationId"
                                value={selectedOrganization.id}
                              />
                              <input
                                type="hidden"
                                name="memberUserId"
                                value={member.userId}
                              />
                              <input
                                type="hidden"
                                name="returnOrganizationId"
                                value={selectedOrganization.id}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                type="submit"
                              >
                                {t("settings.organizations.removeMember")}
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[color:var(--line)] pt-8">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-[var(--ink)]">
                        {t("settings.organizations.inviteLinks")}
                      </h3>
                      {selectedOrganization.isOwner ? (
                        <form action={createOrganizationInviteLinkAction}>
                          <input
                            type="hidden"
                            name="organizationId"
                            value={selectedOrganization.id}
                          />
                          <input
                            type="hidden"
                            name="returnOrganizationId"
                            value={selectedOrganization.id}
                          />
                          <Button variant="secondary" size="sm" type="submit">
                            <Link2 className="size-4" />
                            {t("settings.organizations.newInviteLink")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-4">
                      {selectedOrganization.inviteLinks.length === 0 ? (
                        <div className="py-4 text-sm text-[var(--muted)]">
                          {t("settings.organizations.noInviteLinks")}
                        </div>
                      ) : null}
                      {selectedOrganization.inviteLinks.map((inviteLink) => {
                        return (
                          <div
                            key={inviteLink.id}
                            className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                              <button
                                type="button"
                                onClick={() => copyInviteLink(inviteLink.token)}
                                className="truncate font-mono text-[13px] text-[var(--ink)] transition hover:text-[var(--accent)]"
                              >
                                {`/join/${inviteLink.token}`}
                              </button>
                              <p className="text-xs text-[var(--muted)]">
                                {t("settings.organizations.inviteCreated", {
                                  date: formatDate(
                                    inviteLink.createdAt,
                                    locale,
                                  ),
                                })}
                              </p>
                            </div>
                            {selectedOrganization.isOwner ? (
                              <form action={revokeOrganizationInviteLinkAction}>
                                <input
                                  type="hidden"
                                  name="organizationId"
                                  value={selectedOrganization.id}
                                />
                                <input
                                  type="hidden"
                                  name="inviteLinkId"
                                  value={inviteLink.id}
                                />
                                <input
                                  type="hidden"
                                  name="returnOrganizationId"
                                  value={selectedOrganization.id}
                                />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  type="submit"
                                >
                                  {t("settings.organizations.revokeInvite")}
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedOrganization.isOwner ? (
                    <ManagedWebhooksSection
                      key={selectedOrganization.id}
                      apiBasePath={`/api/organizations/${selectedOrganization.id}/webhooks`}
                      initialWebhooks={selectedOrganization.webhooks}
                      digestTimezone={digestTimezone}
                      description={t(
                        "settings.organizations.webhooksDescription",
                      )}
                      showToast={showToast}
                    />
                  ) : null}

                  {selectedOrganization.isOwner ? (
                    <div className="border-t border-[color:var(--line)] pt-8">
                      <h3 className="text-base font-semibold text-[var(--ink)]">
                        {t("settings.organizations.dangerZone")}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {t("settings.organizations.deleteOrgHelp")}
                      </p>
                      <DeleteOrganizationButton
                        organizationId={selectedOrganization.id}
                        returnOrganizationId={selectedOrganization.id}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
