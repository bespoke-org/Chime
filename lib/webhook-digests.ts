import { db } from "@/lib/db";
import {
  dueDigestSlot,
  getDigestSchedule,
  getDigestTimezone,
} from "@/lib/digest-schedule";
import type { SubmissionSnapshotBlock } from "@/lib/form-submission";
import { normalizeWebhookUrl } from "@/lib/form-webhooks";
import type { AnswerValue } from "@/lib/form-types";
import { parseStoredAnswers } from "@/lib/response-review";
import {
  buildWebhookPayload,
  getWebhookDeliverer,
  WEBHOOK_EVENT_RESPONSES_BATCH,
  type WebhookBatchPayload,
  type WebhookBatchResponse,
} from "@/lib/webhooks";

// One responses.batch event carries at most this many responses; a longer
// period is split into several parts sent in the same tick.
export const DIGEST_BATCH_SIZE = 200;

// A failed digest is retried every tick until the period it covers is this
// old; after that the slot is given up so one dead endpoint does not grow an
// ever larger backlog.
export const DIGEST_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

type DigestForm = { id: string; slug: string; title: string };

type StoredResponse = {
  id: string;
  submittedAt: Date;
  answersJson: unknown;
  formSnapshotJson: unknown;
};

function toBatchResponse(
  form: DigestForm,
  response: StoredResponse,
  baseUrl?: string,
): WebhookBatchResponse {
  const snapshot = Array.isArray(response.formSnapshotJson)
    ? (response.formSnapshotJson as SubmissionSnapshotBlock[])
    : [];
  const payload = buildWebhookPayload(
    form,
    {
      id: response.id,
      submittedAt: response.submittedAt,
      answers: parseStoredAnswers(response.answersJson) as Record<
        string,
        AnswerValue
      >,
    },
    snapshot,
    baseUrl,
  );

  return {
    responseId: payload.responseId,
    submittedAt: payload.submittedAt,
    identity: payload.identity,
    answers: payload.answers,
  };
}

// Each response item is built by the same function as response.created, so
// the two shapes cannot drift apart.
export function buildBatchPayload(
  form: DigestForm,
  period: { start: Date; end: Date },
  part: { index: number; count: number },
  responses: StoredResponse[],
  baseUrl?: string,
): WebhookBatchPayload {
  return {
    event: WEBHOOK_EVENT_RESPONSES_BATCH,
    formId: form.id,
    formSlug: form.slug,
    formTitle: form.title,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    part: part.index,
    parts: part.count,
    responses: responses.map((response) =>
      toBatchResponse(form, response, baseUrl),
    ),
  };
}

export type DigestRunSummary = {
  checked: number;
  sent: number;
  empty: number;
  failed: number;
  dropped: number;
};

type DigestWebhook = { url: string; secret: string | null };

// The forms an organization digest covers: every form of the organization
// except those with their own enabled digest webhook to the same URL, which
// already send that form's batch with their own secret.
async function organizationDigestForms(
  organizationId: string | null,
  url: string,
): Promise<DigestForm[]> {
  if (!organizationId) {
    return [];
  }

  const target = normalizeWebhookUrl(url);
  const forms = await db.form.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      webhooks: {
        where: { mode: "DIGEST", enabled: true },
        select: { url: true },
      },
    },
  });

  return forms
    .filter(
      (form) =>
        !form.webhooks.some(
          (webhook) => normalizeWebhookUrl(webhook.url) === target,
        ),
    )
    .map(({ id, slug, title }) => ({ id, slug, title }));
}

// Sends one form's responses of the period in parts of DIGEST_BATCH_SIZE and
// stops at the first part that is not delivered.
async function sendFormPeriod(
  webhook: DigestWebhook,
  form: DigestForm,
  since: Date,
  slot: Date,
) {
  const where = {
    formId: form.id,
    submittedAt: { gt: since, lte: slot },
  };
  const total = await db.response.count({ where });
  const parts = Math.ceil(total / DIGEST_BATCH_SIZE);
  let delivered = true;

  for (let index = 0; index < parts && delivered; index += 1) {
    const responses = await db.response.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      skip: index * DIGEST_BATCH_SIZE,
      take: DIGEST_BATCH_SIZE,
      select: {
        id: true,
        submittedAt: true,
        answersJson: true,
        formSnapshotJson: true,
      },
    });

    const result = await getWebhookDeliverer()({
      url: webhook.url,
      secret: webhook.secret,
      payload: buildBatchPayload(
        form,
        { start: since, end: slot },
        { index: index + 1, count: parts },
        responses,
      ),
    });

    delivered = result.ok;
  }

  return { total, delivered };
}

// Runs one scheduler tick. Only one app instance is expected to run it; the
// conditional update on lastDigestAt is what keeps two overlapping ticks of
// the same instance from sending the same period twice.
export async function runDueDigests(
  now: Date = new Date(),
): Promise<DigestRunSummary> {
  const zone = getDigestTimezone();
  const summary: DigestRunSummary = {
    checked: 0,
    sent: 0,
    empty: 0,
    failed: 0,
    dropped: 0,
  };

  const webhooks = await db.formWebhook.findMany({
    where: { mode: "DIGEST", enabled: true },
    include: { form: { select: { id: true, slug: true, title: true } } },
  });

  for (const webhook of webhooks) {
    summary.checked += 1;
    const schedule = getDigestSchedule(webhook);

    if (!schedule) {
      console.warn(`Webhook ${webhook.id} has an incomplete digest schedule.`);
      continue;
    }

    const slot = dueDigestSlot(
      schedule,
      webhook.lastDigestAt,
      webhook.createdAt,
      now,
      zone,
    );

    if (!slot) {
      continue;
    }

    const previousLastDigestAt = webhook.lastDigestAt;
    const since = previousLastDigestAt ?? webhook.createdAt;

    // Claim the slot before sending so a concurrent tick skips it.
    const claimed = await db.formWebhook.updateMany({
      where: { id: webhook.id, lastDigestAt: previousLastDigestAt },
      data: { lastDigestAt: slot },
    });

    if (claimed.count === 0) {
      continue;
    }

    const forms = webhook.form
      ? [webhook.form]
      : await organizationDigestForms(webhook.organizationId, webhook.url);
    let total = 0;
    let delivered = true;

    // The forms go one after another; the first failure stops the period,
    // and a retry sends every form of it again. The receiver tells parts
    // apart by formId, periodStart and part.
    for (const form of forms) {
      const result = await sendFormPeriod(webhook, form, since, slot);
      total += result.total;

      if (!result.delivered) {
        delivered = false;
        break;
      }
    }

    if (delivered && total === 0) {
      summary.empty += 1;
      continue;
    }

    if (delivered) {
      summary.sent += 1;
      continue;
    }

    if (now.getTime() - since.getTime() <= DIGEST_RETRY_WINDOW_MS) {
      // Give the slot back so the next tick tries the whole period again.
      await db.formWebhook.updateMany({
        where: { id: webhook.id, lastDigestAt: slot },
        data: { lastDigestAt: previousLastDigestAt },
      });
      summary.failed += 1;
      continue;
    }

    // An organization period stops at the first failing form, so the forms
    // after it are not counted.
    const owner = webhook.formId
      ? `form ${webhook.formId}`
      : `organization ${webhook.organizationId}`;
    const skipped = webhook.formId ? `${total}` : `at least ${total}`;
    console.warn(
      `Digest for webhook ${webhook.id} (${owner}) failed for more than 24 hours; skipping ${skipped} responses up to ${slot.toISOString()}.`,
    );
    summary.dropped += 1;
  }

  return summary;
}
