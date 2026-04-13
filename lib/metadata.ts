import type { Metadata } from "next";

export function resolveTitle(
  title: string | null | undefined,
  fallback: string,
) {
  const normalized = title?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

export function withTitle(title: string): Metadata {
  return { title };
}
