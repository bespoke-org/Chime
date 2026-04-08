import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { createDraftForm } from "@/lib/forms";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const form = await createDraftForm(session.user.id);
  redirect(`/forms/${form.id}/edit`);
}
