import { NextResponse } from "next/server";

import { getAtprotoClientMetadata } from "@/lib/atproto-auth";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getAtprotoClientMetadata());
}
