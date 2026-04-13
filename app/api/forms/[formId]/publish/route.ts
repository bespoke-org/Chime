import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { setOwnedFormPublished } from "@/lib/forms";

export async function POST(request: Request, context: { params: Promise<{ formId: string }> }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { formId } = await context.params;
    const form = await setOwnedFormPublished(session.user.id, formId, payload, session.user.locale);

    return NextResponse.json({ form });
  } catch (error) {
    return handleRouteError(error);
  }
}
