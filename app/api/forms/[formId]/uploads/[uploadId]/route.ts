import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { getOwnedUploadDownloadUrl } from "@/lib/forms";

export async function GET(
  _request: Request,
  context: { params: Promise<{ formId: string; uploadId: string }> },
) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { formId, uploadId } = await context.params;
    const url = await getOwnedUploadDownloadUrl(
      session.user.id,
      formId,
      uploadId,
    );

    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
