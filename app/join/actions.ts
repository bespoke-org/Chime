"use server";

import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { acceptOrganizationInvite } from "@/lib/organizations";
import { setActiveWorkspaceCookie } from "@/lib/workspaces";

export async function acceptOrganizationInviteAction(formData: FormData) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const token = String(formData.get("token") ?? "");
  const { organization } = await acceptOrganizationInvite(
    session.user.id,
    token,
  );

  await setActiveWorkspaceCookie({
    kind: "organization",
    organizationId: organization.id,
  });
  redirect("/dashboard");
}
