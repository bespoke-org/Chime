import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { confirmAvatarUpload } from "@/lib/avatars";

export async function POST(
  _request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { uploadId } = await context.params;
    const result = await confirmAvatarUpload(session.user.id, uploadId);
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
