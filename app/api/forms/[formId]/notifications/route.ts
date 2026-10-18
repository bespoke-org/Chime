import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { setNotificationSubscription } from "@/lib/notification-subscriptions";

const subscriptionSchema = z.object({
  enabled: z.boolean(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { enabled } = subscriptionSchema.parse(await request.json());
    const { formId } = await context.params;

    await setNotificationSubscription(session.user.id, formId, enabled);

    return NextResponse.json({ enabled });
  } catch (error) {
    return handleRouteError(error);
  }
}
