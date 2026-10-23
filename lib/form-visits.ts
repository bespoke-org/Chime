import { FormStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { SlidingWindowRateLimiter } from "@/lib/rate-limit";
import { workspaceAccessWhere } from "@/lib/workspaces";

const formVisitEventSchema = z.object({
  visitorId: z.uuid(),
  event: z.enum(["open", "start", "submit"]),
});

// Records that a browser opened a published form, gave its first answer,
// or submitted it. Visits by people who can edit the form are not recorded, so
// previewing it does not inflate the funnel.
export async function recordFormVisit(
  slug: string,
  payload: unknown,
  viewerUserId: string | null,
) {
  const parsed = formVisitEventSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Invalid visit event.", 400);
  }

  const form = await db.form.findFirst({
    where: { slug, status: FormStatus.PUBLISHED },
    select: { id: true },
  });

  if (!form) {
    return;
  }

  if (viewerUserId) {
    const editable = await db.form.findFirst({
      where: { id: form.id, ...workspaceAccessWhere(viewerUserId) },
      select: { id: true },
    });

    if (editable) {
      return;
    }
  }

  const { visitorId, event } = parsed.data;
  const where = { formId_visitorId: { formId: form.id, visitorId } };

  if (event === "open") {
    await db.formVisit.upsert({
      where,
      create: { formId: form.id, visitorId },
      update: {},
    });
    return;
  }

  // A later event can arrive without the earlier ones when their beacons
  // were lost; it still counts the earlier steps.
  const now = new Date();

  await db.formVisit.upsert({
    where,
    create: {
      formId: form.id,
      visitorId,
      startedAt: now,
      submittedAt: event === "submit" ? now : null,
    },
    update: {},
  });
  await db.formVisit.updateMany({
    where: { formId: form.id, visitorId, startedAt: null },
    data: { startedAt: now },
  });

  if (event === "submit") {
    await db.formVisit.updateMany({
      where: { formId: form.id, visitorId, submittedAt: null },
      data: { submittedAt: now },
    });
  }
}

export async function countFormVisits(formId: string) {
  const [opened, started, submitted] = await Promise.all([
    db.formVisit.count({ where: { formId } }),
    db.formVisit.count({ where: { formId, startedAt: { not: null } } }),
    db.formVisit.count({ where: { formId, submittedAt: { not: null } } }),
  ]);

  return { opened, started, submitted };
}

export function assertVisitRateAllowed(
  limiter: SlidingWindowRateLimiter,
  clientIp: string,
) {
  if (!limiter.hit(clientIp).allowed) {
    throw new AppError("Too many requests. Please try again later.", 429);
  }
}

let sharedLimiter: SlidingWindowRateLimiter | null = null;

// Two events per form view; the limit leaves room for many forms per
// address behind one NAT.
export function getSharedVisitRateLimiter() {
  sharedLimiter ??= new SlidingWindowRateLimiter({
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  return sharedLimiter;
}
