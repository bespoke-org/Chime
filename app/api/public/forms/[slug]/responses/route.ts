import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { createAnonymousResponse } from "@/lib/forms";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const payload = await request.json();
    const { slug } = await context.params;
    const response = await createAnonymousResponse(slug, payload.answers ?? {});

    return NextResponse.json({ responseId: response.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
