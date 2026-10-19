// Shared by the server and the profile form, so it has no server imports.

export const AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

// An uploaded avatar is stored in user.image as this app path, so the
// existing <img src> keeps working and the bucket stays private.
const AVATAR_PATH_PATTERN = /^\/api\/avatars\/([^/]+)\/([0-9a-f]{32})$/;

export function buildAvatarPath(userId: string, uploadId: string) {
  return `/api/avatars/${userId}/${uploadId}`;
}

export function parseAvatarPath(image: string | null | undefined) {
  const match = image ? AVATAR_PATH_PATTERN.exec(image) : null;
  return match ? { userId: match[1], uploadId: match[2] } : null;
}
