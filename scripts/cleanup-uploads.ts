// Deletes pending uploads older than a day from storage and the database.
// Run it from cron, for example hourly: `bun run uploads:cleanup`.
import { db } from "../lib/db";
import { isObjectStorageConfigured } from "../lib/object-storage";
import { deleteStoredObjects } from "../lib/upload-cleanup";
import {
  isExpiredPendingUpload,
  UPLOAD_PENDING_MAX_AGE_MS,
} from "../lib/uploads";

if (!isObjectStorageConfigured()) {
  console.error("Object storage is not configured (S3_* variables).");
  process.exit(1);
}

const now = new Date();
const candidates = await db.upload.findMany({
  where: {
    status: "PENDING",
    createdAt: { lt: new Date(now.getTime() - UPLOAD_PENDING_MAX_AGE_MS) },
  },
  select: { id: true, key: true, status: true, createdAt: true },
  take: 1000,
});

const expired = candidates.filter((upload) =>
  isExpiredPendingUpload(upload, now),
);

let removed = 0;

for (const upload of expired) {
  const { failed } = await deleteStoredObjects([upload.key]);

  if (failed > 0) {
    continue;
  }

  await db.upload.delete({ where: { id: upload.id } });
  removed += 1;
}

console.log(
  `Removed ${removed} of ${expired.length} expired pending upload(s).`,
);
await db.$disconnect();
