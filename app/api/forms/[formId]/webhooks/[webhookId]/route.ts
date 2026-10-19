import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { deleteFormWebhook, updateFormWebhook } from "@/lib/form-webhooks";

type RouteContext = {
  params: Promise<{ formId: string; webhookId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { formId, webhookId } = await context.params;
    const webhooks = await updateFormWebhook(
      session.user.id,
      formId,
      webhookId,
      await request.json(),
    );

    return NextResponse.json({ webhooks });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { formId, webhookId } = await context.params;
    const webhooks = await deleteFormWebhook(
      session.user.id,
      formId,
      webhookId,
    );

    return NextResponse.json({ webhooks });
  } catch (error) {
    return handleRouteError(error);
  }
}
