import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { deleteOwnedBlock, updateOwnedBlock } from "@/lib/forms";

export async function PATCH(request: Request, context: { params: Promise<{ formId: string; blockId: string }> }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { formId, blockId } = await context.params;
    const block = await updateOwnedBlock(session.user.id, formId, blockId, payload);

    return NextResponse.json({ block });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ formId: string; blockId: string }> }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { formId, blockId } = await context.params;
    await deleteOwnedBlock(session.user.id, formId, blockId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
