import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { requestAnonymousUpload } from "@/lib/forms";
import { getClientIp } from "@/lib/rate-limit";
import {
  assertUploadRateAllowed,
  getSharedUploadRateLimiter,
} from "@/lib/uploads";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const payload = await request.json();
    const { slug } = await context.params;

    assertUploadRateAllowed(
      getSharedUploadRateLimiter(),
      getClientIp(request.headers),
    );

    return NextResponse.json(await requestAnonymousUpload(slug, payload));
  } catch (error) {
    return handleRouteError(error);
  }
}
