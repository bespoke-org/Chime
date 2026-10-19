import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getAvatarDownloadUrl } from "@/lib/avatars";

// Avatars appear in member lists, so any visitor with the path may load
// one; the path carries a random upload id and only the current avatar
// resolves.
export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string; uploadId: string }> },
) {
  try {
    const { userId, uploadId } = await context.params;
    const url = await getAvatarDownloadUrl(userId, uploadId);

    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=240" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
