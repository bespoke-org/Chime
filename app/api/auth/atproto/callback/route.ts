import { NextRequest, NextResponse } from "next/server";

import {
  completeAtprotoSignIn,
  getAtprotoRedirectUrl,
  getNextAuthSessionCookieName,
} from "@/lib/atproto-auth";
import { SignInNotAllowedError } from "@/lib/sign-in-allowlist";

export const runtime = "nodejs";

function redirectWithError(error: string) {
  const url = getAtprotoRedirectUrl("/");
  url.searchParams.set("authError", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  try {
    const result = await completeAtprotoSignIn(request.nextUrl.searchParams);
    const response = NextResponse.redirect(
      getAtprotoRedirectUrl(result.callbackUrl),
    );

    response.cookies.set(getNextAuthSessionCookieName(), result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: getNextAuthSessionCookieName().startsWith("__Secure-"),
      path: "/",
      expires: result.expires,
    });

    return response;
  } catch (error) {
    if (error instanceof SignInNotAllowedError) {
      return redirectWithError("not_allowed");
    }

    console.error("ATProto sign-in callback failed", error);
    return redirectWithError("callback_failed");
  }
}
