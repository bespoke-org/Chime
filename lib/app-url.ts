export function getAppBaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NEXTAUTH_URL?.trim() || env.ATPROTO_PUBLIC_URL?.trim() || "";
}
