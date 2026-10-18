import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { createAnonymousResponse } from "@/lib/forms";
import { getClientIp } from "@/lib/rate-limit";
import {
  SUBMISSION_HONEYPOT_FIELD,
  assertSubmissionRateAllowed,
  getSharedSubmissionRateLimiters,
  getSubmissionGuardConfig,
  isSubmissionTrapped,
} from "@/lib/submission-guard";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const payload = await request.json();
    const { slug } = await context.params;

    assertSubmissionRateAllowed(
      getSharedSubmissionRateLimiters(),
      slug,
      getClientIp(request.headers),
    );

    if (
      isSubmissionTrapped({
        honeypot: payload?.[SUBMISSION_HONEYPOT_FIELD],
        startedAt: payload?.startedAt,
        minFillMs: getSubmissionGuardConfig().minFillMs,
      })
    ) {
      return NextResponse.json({ responseId: randomUUID() });
    }

    const response = await createAnonymousResponse(slug, payload.answers ?? {});

    return NextResponse.json({ responseId: response.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
