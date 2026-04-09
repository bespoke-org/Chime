"use client";

import { Link2, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  createOrganizationAction,
  createOrganizationInviteLinkAction,
  deleteOrganizationAction,
  removeOrganizationMemberAction,
  renameOrganizationAction,
  revokeOrganizationInviteLinkAction,
} from "@/app/(creator)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastViewport, type ToastData } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OrganizationSettingsSummary } from "@/lib/form-types";
import { formatDate } from "@/lib/utils";

export function OrganizationSettingsPanel({
  organizations,
  initialOrganizationId,
}: {
  organizations: OrganizationSettingsSummary[];
  initialOrganizationId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(initialOrganizationId ?? organizations[0]?.id ?? null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId) ?? organizations[0] ?? null,
    [organizations, selectedOrganizationId],
  );

  function showToast(message: string, variant: ToastData["variant"] = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, variant }]);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  async function copyInviteLink(token: string) {
    try {
      const url = `${window.location.origin}/join/${token}`;
      await navigator.clipboard.writeText(url);
      showToast("Copied invite link.");
    } catch {
      showToast("Could not copy invite link.", "error");
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Organizations</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">Workspace settings</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Create shared workspaces, manage members, and issue invite links. Inside an organization, every member can work with forms. Only the owner can manage the organization itself.
          </p>
        </div>

      <div className="mt-8 border-t border-[color:var(--line)] pt-8">
        <form action={createOrganizationAction} className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <input type="hidden" name="returnOrganizationId" value={selectedOrganizationId ?? ""} />
          <label className="flex-1 space-y-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">New organization name</span>
            <Input name="name" placeholder="Acme Studio" />
          </label>
          <Button type="submit">Create organization</Button>
        </form>
      </div>

      <div className="mt-8 space-y-5">
        {organizations.length === 0 ? (
          <div className="border-t border-[color:var(--line)] py-6 text-sm text-[var(--muted)]">
            You are not part of any organizations yet.
          </div>
        ) : null}

        {selectedOrganization ? (
          <>
            <div className="max-w-md border-t border-[color:var(--line)] pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Organization</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The settings below apply to the selected organization.</p>
              <div className="mt-3">
              <Select
                value={selectedOrganization.id}
                onValueChange={(value) => {
                  setSelectedOrganizationId(value);

                  const nextParams = new URLSearchParams(searchParams.toString());
                  nextParams.set("organization", value);
                  router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
                }}
              >
                <SelectTrigger className="min-w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                      {organization.isOwner ? " · Owner" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>

            <div className="border-t border-[color:var(--line)] pt-8">
              <div className="border-b border-[color:var(--line)] pb-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-3xl text-[var(--ink)]">{selectedOrganization.name}</h2>
                  <Badge className="rounded-full">{selectedOrganization.isOwner ? "Owner" : "Member"}</Badge>
                </div>

                {selectedOrganization.isOwner ? (
                  <form key={selectedOrganization.id} action={renameOrganizationAction} className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
                    <input type="hidden" name="organizationId" value={selectedOrganization.id} />
                    <input type="hidden" name="returnOrganizationId" value={selectedOrganization.id} />
                    <div className="flex-1">
                      <Input name="name" defaultValue={selectedOrganization.name} />
                    </div>
                    <Button type="submit" variant="secondary">
                      Rename organization
                    </Button>
                  </form>
                ) : null}
              </div>

              <div className="mt-6 space-y-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Members</p>
                  <div className="mt-4 space-y-4">
                    {selectedOrganization.members.map((member) => (
                      <div key={member.userId} className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-medium text-[var(--ink)]">{member.name || member.email || "Unnamed member"}</p>
                          {member.email ? <p className="text-sm text-[var(--muted)]">{member.email}</p> : null}
                          <Badge className="rounded-full">{member.role === "OWNER" ? "Owner" : "Member"}</Badge>
                        </div>
                        {selectedOrganization.isOwner && member.role !== "OWNER" ? (
                          <form action={removeOrganizationMemberAction}>
                            <input type="hidden" name="organizationId" value={selectedOrganization.id} />
                            <input type="hidden" name="memberUserId" value={member.userId} />
                            <input type="hidden" name="returnOrganizationId" value={selectedOrganization.id} />
                            <Button variant="secondary" size="sm" type="submit">
                              Remove
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[color:var(--line)] pt-8">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Invite links</p>
                    {selectedOrganization.isOwner ? (
                      <form action={createOrganizationInviteLinkAction}>
                        <input type="hidden" name="organizationId" value={selectedOrganization.id} />
                        <input type="hidden" name="returnOrganizationId" value={selectedOrganization.id} />
                        <Button variant="secondary" size="sm" type="submit">
                          <Link2 className="size-4" />
                          New invite link
                        </Button>
                      </form>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-4">
                    {selectedOrganization.inviteLinks.length === 0 ? (
                      <div className="py-4 text-sm text-[var(--muted)]">
                        No invite links yet.
                      </div>
                    ) : null}
                    {selectedOrganization.inviteLinks.map((inviteLink) => {
                      return (
                        <div key={inviteLink.id} className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <button
                              type="button"
                              onClick={() => copyInviteLink(inviteLink.token)}
                              className="truncate font-mono text-[13px] text-[var(--ink)] transition hover:text-[var(--accent)]"
                            >
                              {`/join/${inviteLink.token}`}
                            </button>
                            <p className="text-xs text-[var(--muted)]">Created {formatDate(inviteLink.createdAt)}</p>
                          </div>
                          {selectedOrganization.isOwner ? (
                            <form action={revokeOrganizationInviteLinkAction}>
                              <input type="hidden" name="organizationId" value={selectedOrganization.id} />
                              <input type="hidden" name="inviteLinkId" value={inviteLink.id} />
                              <input type="hidden" name="returnOrganizationId" value={selectedOrganization.id} />
                              <Button variant="secondary" size="sm" type="submit">
                                Revoke
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedOrganization.isOwner ? (
                  <div className="border-t border-[color:var(--line)] pt-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Danger zone</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Deleting an organization also deletes its forms, responses, memberships, and invite links.</p>
                    <form action={deleteOrganizationAction} className="mt-4">
                      <input type="hidden" name="organizationId" value={selectedOrganization.id} />
                      <input type="hidden" name="returnOrganizationId" value={selectedOrganization.id} />
                      <Button variant="danger" type="submit">
                        <Trash2 className="size-4" />
                        Delete organization
                      </Button>
                    </form>
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
