import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { requestAvatarUpload } from "@/lib/avatars";

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    return NextResponse.json(
      await requestAvatarUpload(session.user.id, payload),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
