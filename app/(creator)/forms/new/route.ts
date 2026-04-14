import { redirect } from "next/navigation";

import { requireServerAuthSession } from "@/lib/auth";
import { createDraftForm } from "@/lib/forms";
import { getActiveWorkspaceForUser } from "@/lib/workspaces";

export async function GET() {
  const session = await requireServerAuthSession();

  const { activeWorkspace } = await getActiveWorkspaceForUser(session.user.id);
  const form = await createDraftForm(session.user.id, activeWorkspace);
  redirect(`/forms/${form.id}/edit`);
}
