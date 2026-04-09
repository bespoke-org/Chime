"use server";

import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { createDraftForm } from "@/lib/forms";
import {
  createOrganization,
  createOrganizationInviteLink,
  deleteOrganization,
  removeOrganizationMember,
  renameOrganization,
  revokeOrganizationInviteLink,
} from "@/lib/organizations";
import { parseWorkspaceValue, setActiveWorkspaceCookie, getActiveWorkspaceForUser } from "@/lib/workspaces";

async function requireSessionUser() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  return session.user.id;
}

function settingsRedirectTarget(formData: FormData, fallbackOrganizationId?: string | null) {
  const rawValue = String(formData.get("returnOrganizationId") ?? fallbackOrganizationId ?? "").trim();
  return rawValue ? `/settings?organization=${encodeURIComponent(rawValue)}` : "/settings";
}

export async function createFormAction() {
  const userId = await requireSessionUser();
  const { activeWorkspace } = await getActiveWorkspaceForUser(userId);
  const form = await createDraftForm(userId, activeWorkspace);

  redirect(`/forms/${form.id}/edit`);
}

export async function setActiveWorkspaceAction(formData: FormData) {
  const userId = await requireSessionUser();
  const { options } = await getActiveWorkspaceForUser(userId);
  const nextValue = String(formData.get("workspace") ?? "personal");
  const isValidOption = options.some((option) => option.value === nextValue);

  await setActiveWorkspaceCookie(isValidOption ? parseWorkspaceValue(nextValue) : { kind: "personal" });
}

export async function createOrganizationAction(formData: FormData) {
  const userId = await requireSessionUser();
  const organization = await createOrganization(userId, { name: formData.get("name") });

  await setActiveWorkspaceCookie({ kind: "organization", organizationId: organization.id });
  redirect(settingsRedirectTarget(formData, organization.id));
}

export async function renameOrganizationAction(formData: FormData) {
  const userId = await requireSessionUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await renameOrganization(userId, organizationId, { name: formData.get("name") });
  redirect(settingsRedirectTarget(formData, organizationId));
}

export async function deleteOrganizationAction(formData: FormData) {
  const userId = await requireSessionUser();
  await deleteOrganization(userId, String(formData.get("organizationId") ?? ""));
  await setActiveWorkspaceCookie({ kind: "personal" });
  redirect("/settings");
}

export async function createOrganizationInviteLinkAction(formData: FormData) {
  const userId = await requireSessionUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await createOrganizationInviteLink(userId, organizationId);
  redirect(settingsRedirectTarget(formData, organizationId));
}

export async function revokeOrganizationInviteLinkAction(formData: FormData) {
  const userId = await requireSessionUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await revokeOrganizationInviteLink(
    userId,
    organizationId,
    String(formData.get("inviteLinkId") ?? ""),
  );
  redirect(settingsRedirectTarget(formData, organizationId));
}

export async function removeOrganizationMemberAction(formData: FormData) {
  const userId = await requireSessionUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  await removeOrganizationMember(
    userId,
    organizationId,
    String(formData.get("memberUserId") ?? ""),
  );
  redirect(settingsRedirectTarget(formData, organizationId));
}
