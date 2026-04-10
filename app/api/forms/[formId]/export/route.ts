import { handleRouteError } from "@/lib/api";
import { getServerAuthSession } from "@/lib/auth";
import { createOwnedFormResponseExport, parseResponseExportFormat } from "@/lib/response-exports";

export async function GET(request: Request, context: { params: Promise<{ formId: string }> }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { formId } = await context.params;
    const format = parseResponseExportFormat(new URL(request.url).searchParams.get("format"));
    const exportFile = await createOwnedFormResponseExport(session.user.id, formId, format, session.user.locale);

    return new Response(exportFile.body, {
      status: 200,
      headers: {
        "Content-Type": exportFile.contentType,
        "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
