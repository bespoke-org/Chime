import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { createDraftForm } from "@/lib/forms";
import { getActiveWorkspaceForUser } from "@/lib/workspaces";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const { activeWorkspace } = await getActiveWorkspaceForUser(session.user.id);
  const form = await createDraftForm(session.user.id, activeWorkspace);
  redirect(`/forms/${form.id}/edit`);
}
