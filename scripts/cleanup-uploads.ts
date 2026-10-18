// Deletes pending uploads older than a day from storage and the database.
// Run it from cron, for example hourly: `bun run uploads:cleanup`.
import { db } from "../lib/db";
import { getObjectStorage } from "../lib/object-storage";
import {
  isExpiredPendingUpload,
  UPLOAD_PENDING_MAX_AGE_MS,
} from "../lib/uploads";

const storage = getObjectStorage();

if (!storage) {
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

let removed = 0;

for (const upload of candidates) {
  if (!isExpiredPendingUpload(upload, now)) {
    continue;
  }

  await storage.deleteObject(upload.key);
  await db.upload.delete({ where: { id: upload.id } });
  removed += 1;
}

console.log(`Removed ${removed} pending upload(s).`);
await db.$disconnect();
