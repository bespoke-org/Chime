import { redirect } from "next/navigation";

import { requireServerAuthSession } from "@/lib/auth";
import { createDraftForm } from "@/lib/forms";
import { resolveLocaleForUser } from "@/lib/i18n-server";
import { getActiveWorkspaceForUser } from "@/lib/workspaces";

export async function GET() {
  const session = await requireServerAuthSession();

  const { activeWorkspace } = await getActiveWorkspaceForUser(session.user.id);
  const form = await createDraftForm(
    session.user.id,
    activeWorkspace,
    await resolveLocaleForUser(session.user.locale),
  );
  redirect(`/forms/${form.id}/edit`);
}
