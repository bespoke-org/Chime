import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getObjectStorage } from "@/lib/object-storage";

export type UploadOwner =
  | { formId: string }
  | { blockId: string }
  | { organizationId: string };

export function buildUploadOwnerWhere(
  owner: UploadOwner,
): Prisma.UploadWhereInput {
  if ("formId" in owner) {
    return { formId: owner.formId };
  }

  if ("blockId" in owner) {
    return { blockId: owner.blockId };
  }

  return { form: { organizationId: owner.organizationId } };
}

// Removes objects one by one and never throws: a missing bucket or a failed
// delete must not fail the request that already removed the rows.
export async function deleteStoredObjects(keys: string[]) {
  const storage = getObjectStorage();

  if (!storage || keys.length === 0) {
    return { deleted: 0, failed: 0 };
  }

  let deleted = 0;
  let failed = 0;

  for (const key of keys) {
    try {
      await storage.deleteObject(key);
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `Could not delete stored object ${failed} of ${keys.length}.`,
        error,
      );
    }
  }

  return { deleted, failed };
}

// The rows cascade with their owner, so the keys are read before the
// caller's delete and the objects are removed after it has committed.
export async function removeUploadsFor(
  owner: UploadOwner,
  deleteOwner: () => Promise<void>,
) {
  const keys = getObjectStorage()
    ? (
        await db.upload.findMany({
          where: buildUploadOwnerWhere(owner),
          select: { key: true },
        })
      ).map((upload) => upload.key)
    : [];

  await deleteOwner();

  return deleteStoredObjects(keys);
}
