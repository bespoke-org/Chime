"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  requireServerAuthSession,
  requireServerSessionUserId,
} from "@/lib/auth";
import { createDraftForm } from "@/lib/forms";
import {
  createOrganization,
  createOrganizationInviteLink,
  deleteOrganization,
  removeOrganizationMember,
  renameOrganization,
  revokeOrganizationInviteLink,
} from "@/lib/organizations";
import { updateProfileSettings } from "@/lib/users";
import {
  parseWorkspaceValue,
  setActiveWorkspaceCookie,
  getActiveWorkspaceForUser,
} from "@/lib/workspaces";

function settingsRedirectTarget(
  formData: FormData,
  fallback?: { organizationId?: string | null; section?: string | null },
) {
  const organizationId = String(
    formData.get("returnOrganizationId") ?? fallback?.organizationId ?? "",
  ).trim();
  const section = String(
    formData.get("returnSection") ?? fallback?.section ?? "",
  ).trim();
  const params = new URLSearchParams();

  if (section) {
    params.set("section", section);
  }

  if (organizationId) {
    params.set("organization", organizationId);
  }

  const query = params.toString();
  return query ? `/settings?${query}` : "/settings";
}

export async function createFormAction() {
  const session = await requireServerAuthSession();
  const { activeWorkspace } = await getActiveWorkspaceForUser(session.user.id);
  const form = await createDraftForm(
    session.user.id,
    activeWorkspace,
    session.user.locale,
  );

  redirect(`/forms/${form.id}/edit`);
}

export async function setActiveWorkspaceAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  const { options } = await getActiveWorkspaceForUser(userId);
  const nextValue = String(formData.get("workspace") ?? "personal");
  const isValidOption = options.some((option) => option.value === nextValue);

  await setActiveWorkspaceCookie(
    isValidOption ? parseWorkspaceValue(nextValue) : { kind: "personal" },
  );
}

export async function createOrganizationAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  const organization = await createOrganization(userId, {
    name: formData.get("name"),
  });

  await setActiveWorkspaceCookie({
    kind: "organization",
    organizationId: organization.id,
  });
  redirect(
    settingsRedirectTarget(formData, {
      organizationId: organization.id,
      section: "organizations",
    }),
  );
}

export async function renameOrganizationAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  const organizationId = String(formData.get("organizationId") ?? "");
  await renameOrganization(userId, organizationId, {
    name: formData.get("name"),
  });
  redirect(
    settingsRedirectTarget(formData, {
      organizationId,
      section: "organizations",
    }),
  );
}

export async function deleteOrganizationAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  await deleteOrganization(
    userId,
    String(formData.get("organizationId") ?? ""),
  );
  await setActiveWorkspaceCookie({ kind: "personal" });
  redirect(settingsRedirectTarget(formData, { section: "organizations" }));
}

export async function createOrganizationInviteLinkAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  const organizationId = String(formData.get("organizationId") ?? "");
  await createOrganizationInviteLink(userId, organizationId);
  redirect(
    settingsRedirectTarget(formData, {
      organizationId,
      section: "organizations",
    }),
  );
}

export async function revokeOrganizationInviteLinkAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  const organizationId = String(formData.get("organizationId") ?? "");
  await revokeOrganizationInviteLink(
    userId,
    organizationId,
    String(formData.get("inviteLinkId") ?? ""),
  );
  redirect(
    settingsRedirectTarget(formData, {
      organizationId,
      section: "organizations",
    }),
  );
}

export async function removeOrganizationMemberAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  const organizationId = String(formData.get("organizationId") ?? "");
  await removeOrganizationMember(
    userId,
    organizationId,
    String(formData.get("memberUserId") ?? ""),
  );
  redirect(
    settingsRedirectTarget(formData, {
      organizationId,
      section: "organizations",
    }),
  );
}

export async function updateProfileAction(formData: FormData) {
  const userId = await requireServerSessionUserId();
  await updateProfileSettings(userId, {
    firstName: formData.get("firstName"),
    secondName: formData.get("secondName"),
    locale: formData.get("locale"),
    image: formData.get("image"),
    notificationEmail: formData.get("notificationEmail"),
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
