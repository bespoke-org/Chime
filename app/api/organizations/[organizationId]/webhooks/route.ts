import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import {
  createOrganizationWebhook,
  listOrganizationWebhooks,
} from "@/lib/form-webhooks";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await context.params;
    const webhooks = await listOrganizationWebhooks(
      session.user.id,
      organizationId,
    );

    return NextResponse.json({ webhooks });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await context.params;
    const webhooks = await createOrganizationWebhook(
      session.user.id,
      organizationId,
      await request.json(),
    );

    return NextResponse.json({ webhooks }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
