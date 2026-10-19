import type { FormWebhook } from "@prisma/client";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  MAX_FORM_WEBHOOKS,
  type FormWebhookSummary,
  type OrganizationWebhookSummary,
  type ReusableWebhook,
} from "@/lib/form-types";
import {
  webhookInputSchema,
  type WebhookInput,
} from "@/lib/webhook-validators";
import {
  assertOrganizationOwner,
  workspaceAccessWhere,
} from "@/lib/workspaces";

// A webhook belongs to one form or to one organization.
type WebhookOwner = { formId: string } | { organizationId: string };

// Two URLs that differ only in the case of the scheme or host, a default
// port, a trailing "/" or a fragment reach the same endpoint. The query is
// kept, since it often selects the receiver.
export function normalizeWebhookUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}${url.search}`;
  } catch {
    return value.trim();
  }
}

// The secret is shown to anyone who can open the builder, same as before
// webhooks had their own table; it is never part of the public form.
export function toFormWebhookSummary(webhook: FormWebhook): FormWebhookSummary {
  return {
    id: webhook.id,
    url: webhook.url,
    secret: webhook.secret,
    enabled: webhook.enabled,
    mode: webhook.mode,
    digestInterval: webhook.digestInterval,
    digestTime: webhook.digestTime,
    digestWeekday: webhook.digestWeekday,
    lastDigestAt: webhook.lastDigestAt
      ? webhook.lastDigestAt.toISOString()
      : null,
    createdAt: webhook.createdAt.toISOString(),
  };
}

// What form settings show about an organization webhook to any member: no
// secret, since only the owner manages it.
export function toOrganizationWebhookSummary(
  webhook: FormWebhook,
): OrganizationWebhookSummary {
  return {
    id: webhook.id,
    url: webhook.url,
    enabled: webhook.enabled,
    mode: webhook.mode,
    digestInterval: webhook.digestInterval,
    digestTime: webhook.digestTime,
    digestWeekday: webhook.digestWeekday,
  };
}

// Anyone who can open the form in the builder may manage its webhooks.
async function assertAccessibleForm(userId: string, formId: string) {
  const form = await db.form.findFirst({
    where: { id: formId, ...workspaceAccessWhere(userId) },
    select: { id: true },
  });

  if (!form) {
    throw new AppError("Form not found.", 404);
  }
}

async function listWebhooksOf(owner: WebhookOwner) {
  const webhooks = await db.formWebhook.findMany({
    where: owner,
    orderBy: { createdAt: "asc" },
  });

  return webhooks.map(toFormWebhookSummary);
}

async function createWebhookOf(owner: WebhookOwner, input: WebhookInput) {
  const count = await db.formWebhook.count({ where: owner });

  if (count >= MAX_FORM_WEBHOOKS) {
    throw new AppError(
      "formId" in owner
        ? `A form can have at most ${MAX_FORM_WEBHOOKS} webhooks.`
        : `An organization can have at most ${MAX_FORM_WEBHOOKS} webhooks.`,
      422,
    );
  }

  await db.formWebhook.create({ data: { ...owner, ...input } });

  return listWebhooksOf(owner);
}

function sameSchedule(
  a: Pick<
    FormWebhook,
    "mode" | "digestInterval" | "digestTime" | "digestWeekday"
  >,
  b: Pick<
    FormWebhook,
    "mode" | "digestInterval" | "digestTime" | "digestWeekday"
  >,
) {
  return (
    a.mode === b.mode &&
    a.digestInterval === b.digestInterval &&
    a.digestTime === b.digestTime &&
    a.digestWeekday === b.digestWeekday
  );
}

async function updateWebhookOf(
  owner: WebhookOwner,
  webhookId: string,
  input: WebhookInput,
  now: Date,
) {
  const existing = await db.formWebhook.findFirst({
    where: { id: webhookId, ...owner },
  });

  if (!existing) {
    throw new AppError("Webhook not found.", 404);
  }

  // A changed digest schedule starts a fresh period from now, so the next
  // digest does not reach back over responses already sent one by one.
  const restartPeriod =
    input.mode === "DIGEST" && !sameSchedule(existing, input);

  await db.formWebhook.update({
    where: { id: webhookId },
    data: {
      ...input,
      ...(restartPeriod ? { lastDigestAt: now } : {}),
    },
  });

  return listWebhooksOf(owner);
}

async function deleteWebhookOf(owner: WebhookOwner, webhookId: string) {
  const { count } = await db.formWebhook.deleteMany({
    where: { id: webhookId, ...owner },
  });

  if (count === 0) {
    throw new AppError("Webhook not found.", 404);
  }

  return listWebhooksOf(owner);
}

export async function listFormWebhooks(userId: string, formId: string) {
  await assertAccessibleForm(userId, formId);
  return listWebhooksOf({ formId });
}

// Webhooks of the user's other forms, newest first. Copies that would fill
// the editor the same way are listed once.
export async function listReusableFormWebhooks(userId: string, formId: string) {
  await assertAccessibleForm(userId, formId);

  const webhooks = await db.formWebhook.findMany({
    where: { formId: { not: formId }, form: workspaceAccessWhere(userId) },
    include: { form: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  const reusable: ReusableWebhook[] = [];

  for (const webhook of webhooks) {
    const key = JSON.stringify([
      normalizeWebhookUrl(webhook.url),
      webhook.secret,
      webhook.mode,
      webhook.digestInterval,
      webhook.digestTime,
      webhook.digestWeekday,
    ]);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    reusable.push({
      url: webhook.url,
      secret: webhook.secret,
      mode: webhook.mode,
      digestInterval: webhook.digestInterval,
      digestTime: webhook.digestTime,
      digestWeekday: webhook.digestWeekday,
      formTitle: webhook.form?.title ?? "",
    });
  }

  return reusable;
}

export async function createFormWebhook(
  userId: string,
  formId: string,
  payload: unknown,
) {
  const input = webhookInputSchema.parse(payload);
  await assertAccessibleForm(userId, formId);
  return createWebhookOf({ formId }, input);
}

export async function updateFormWebhook(
  userId: string,
  formId: string,
  webhookId: string,
  payload: unknown,
  now: Date = new Date(),
) {
  const input = webhookInputSchema.parse(payload);
  await assertAccessibleForm(userId, formId);
  return updateWebhookOf({ formId }, webhookId, input, now);
}

export async function deleteFormWebhook(
  userId: string,
  formId: string,
  webhookId: string,
) {
  await assertAccessibleForm(userId, formId);
  return deleteWebhookOf({ formId }, webhookId);
}

// Organization webhooks cover every form of the organization, so only the
// owner manages them; members see them read-only in form settings.
export async function listOrganizationWebhooks(
  userId: string,
  organizationId: string,
) {
  await assertOrganizationOwner(userId, organizationId);
  return listWebhooksOf({ organizationId });
}

export async function createOrganizationWebhook(
  userId: string,
  organizationId: string,
  payload: unknown,
) {
  const input = webhookInputSchema.parse(payload);
  await assertOrganizationOwner(userId, organizationId);
  return createWebhookOf({ organizationId }, input);
}

export async function updateOrganizationWebhook(
  userId: string,
  organizationId: string,
  webhookId: string,
  payload: unknown,
  now: Date = new Date(),
) {
  const input = webhookInputSchema.parse(payload);
  await assertOrganizationOwner(userId, organizationId);
  return updateWebhookOf({ organizationId }, webhookId, input, now);
}

export async function deleteOrganizationWebhook(
  userId: string,
  organizationId: string,
  webhookId: string,
) {
  await assertOrganizationOwner(userId, organizationId);
  return deleteWebhookOf({ organizationId }, webhookId);
}
