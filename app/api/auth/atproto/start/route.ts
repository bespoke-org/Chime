import { NextRequest, NextResponse } from "next/server";

import {
  getAtprotoAuthorizationUrl,
  getAtprotoRedirectUrl,
  getSafeAtprotoCallbackUrl,
} from "@/lib/atproto-auth";

export const runtime = "nodejs";

function redirectWithError(error: string) {
  const url = getAtprotoRedirectUrl("/");
  url.searchParams.set("authError", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const identifier = String(formData.get("identifier") ?? "");
  const callbackUrl = getSafeAtprotoCallbackUrl(
    typeof formData.get("callbackUrl") === "string"
      ? String(formData.get("callbackUrl"))
      : null,
  );

  try {
    const authorizationUrl = await getAtprotoAuthorizationUrl(identifier, {
      callbackUrl,
    });

    // The request that starts OAuth is a form POST. A 303 makes the browser
    // follow the authorization URL with GET instead of replaying the POST to
    // the PDS authorization page.
    return NextResponse.redirect(authorizationUrl, 303);
  } catch (error) {
    console.error("ATProto sign-in start failed", error);
    return redirectWithError("start_failed");
  }
}
