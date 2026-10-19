import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import {
  deleteOrganizationWebhook,
  updateOrganizationWebhook,
} from "@/lib/form-webhooks";

type RouteContext = {
  params: Promise<{ organizationId: string; webhookId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId, webhookId } = await context.params;
    const webhooks = await updateOrganizationWebhook(
      session.user.id,
      organizationId,
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
    const { organizationId, webhookId } = await context.params;
    const webhooks = await deleteOrganizationWebhook(
      session.user.id,
      organizationId,
      webhookId,
    );

    return NextResponse.json({ webhooks });
  } catch (error) {
    return handleRouteError(error);
  }
}
