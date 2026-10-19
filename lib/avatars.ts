import { z } from "zod";

import {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  buildAvatarPath,
  parseAvatarPath,
} from "@/lib/avatar-rules";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getObjectStorage } from "@/lib/object-storage";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  UPLOAD_URL_TTL_SECONDS,
} from "@/lib/uploads";

const avatarUploadRequestSchema = z.object({
  contentType: z.enum(AVATAR_CONTENT_TYPES),
  size: z.number().int().positive().max(AVATAR_MAX_BYTES),
});

export function buildAvatarKey(userId: string, uploadId: string) {
  return `avatars/${userId}/${uploadId}`;
}

function requireStorage() {
  const storage = getObjectStorage();

  if (!storage) {
    throw new AppError("File uploads are not available right now.", 503);
  }

  return storage;
}

export async function requestAvatarUpload(userId: string, payload: unknown) {
  const parsed = avatarUploadRequestSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Use a JPEG, PNG or WebP image up to 2 MB.", 400);
  }

  const storage = requireStorage();
  const uploadId = crypto.randomUUID().replaceAll("-", "");
  const url = await storage.createUploadUrl({
    key: buildAvatarKey(userId, uploadId),
    contentType: parsed.data.contentType,
    contentLength: parsed.data.size,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });

  return {
    uploadId,
    url,
    method: "PUT" as const,
    headers: { "content-type": parsed.data.contentType },
  };
}

// Called after the browser has sent the bytes: checks the stored object
// against the limits and makes it the user's avatar.
export async function confirmAvatarUpload(userId: string, uploadId: string) {
  if (!/^[0-9a-f]{32}$/.test(uploadId)) {
    throw new AppError("Upload not found.", 404);
  }

  const storage = requireStorage();
  const key = buildAvatarKey(userId, uploadId);
  const head = await storage.headObject(key);

  if (!head) {
    throw new AppError("Upload not found.", 404);
  }

  const contentTypeAllowed = (
    AVATAR_CONTENT_TYPES as readonly string[]
  ).includes(head.contentType);

  if (!contentTypeAllowed || head.size > AVATAR_MAX_BYTES) {
    await storage.deleteObject(key);
    throw new AppError("Use a JPEG, PNG or WebP image up to 2 MB.", 400);
  }

  const previous = await db.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  const image = buildAvatarPath(userId, uploadId);

  await db.user.update({ where: { id: userId }, data: { image } });
  await removeReplacedAvatar(userId, previous?.image ?? null, image);

  return { image };
}

// Deletes the stored file of the user's previous uploaded avatar once
// user.image points elsewhere. Storage failures are logged, not thrown.
export async function removeReplacedAvatar(
  userId: string,
  previousImage: string | null,
  nextImage: string | null,
) {
  const previous = parseAvatarPath(previousImage);

  if (!previous || previous.userId !== userId || previousImage === nextImage) {
    return;
  }

  const storage = getObjectStorage();

  if (!storage) {
    return;
  }

  try {
    await storage.deleteObject(buildAvatarKey(userId, previous.uploadId));
  } catch (error) {
    console.error("Could not delete the replaced avatar.", error);
  }
}

export async function getAvatarDownloadUrl(userId: string, uploadId: string) {
  const image = buildAvatarPath(userId, uploadId);
  const user = await db.user.findFirst({
    where: { id: userId, image },
    select: { id: true },
  });

  if (!user) {
    throw new AppError("Avatar not found.", 404);
  }

  return requireStorage().createDownloadUrl({
    key: buildAvatarKey(userId, uploadId),
    filename: "avatar",
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  });
}
