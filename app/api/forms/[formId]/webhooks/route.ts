import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { createFormWebhook, listFormWebhooks } from "@/lib/form-webhooks";

export async function GET(
  _request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { formId } = await context.params;
    const webhooks = await listFormWebhooks(session.user.id, formId);

    return NextResponse.json({ webhooks });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { formId } = await context.params;
    const webhooks = await createFormWebhook(
      session.user.id,
      formId,
      await request.json(),
    );

    return NextResponse.json({ webhooks }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
