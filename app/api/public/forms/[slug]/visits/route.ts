import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import {
  assertVisitRateAllowed,
  getSharedVisitRateLimiter,
  recordFormVisit,
} from "@/lib/form-visits";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const payload = await request.json();
    const { slug } = await context.params;

    assertVisitRateAllowed(
      getSharedVisitRateLimiter(),
      getClientIp(request.headers),
    );

    const session = await getServerAuthSession();
    await recordFormVisit(slug, payload, session?.user?.id ?? null);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
