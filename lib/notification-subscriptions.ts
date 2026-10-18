import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { workspaceAccessWhere } from "@/lib/workspaces";

// Anyone who can open the form in the builder may subscribe to it: the owner
// of a personal form or any member of the form's organization.
async function assertSubscribableForm(userId: string, formId: string) {
  const form = await db.form.findFirst({
    where: { id: formId, ...workspaceAccessWhere(userId) },
    select: { id: true },
  });

  if (!form) {
    throw new AppError("Form not found.", 404);
  }
}

export async function getNotificationSubscriptionForUser(
  userId: string,
  formId: string,
) {
  const subscription = await db.formNotificationSubscription.findUnique({
    where: { formId_userId: { formId, userId } },
    select: { formId: true },
  });

  return subscription !== null;
}

export async function setNotificationSubscription(
  userId: string,
  formId: string,
  enabled: boolean,
) {
  await assertSubscribableForm(userId, formId);

  if (enabled) {
    await db.formNotificationSubscription.upsert({
      where: { formId_userId: { formId, userId } },
      create: { formId, userId },
      update: {},
    });
  } else {
    await db.formNotificationSubscription.deleteMany({
      where: { formId, userId },
    });
  }

  return enabled;
}

export type NotificationRecipient = {
  id: string;
  notificationEmail: string;
  locale: string | null;
};

// Subscribers without a notification email are left out here rather than at
// send time, so the caller sees only addresses it can actually use.
export async function listNotificationRecipients(
  formId: string,
): Promise<NotificationRecipient[]> {
  const subscriptions = await db.formNotificationSubscription.findMany({
    where: { formId },
    select: {
      user: { select: { id: true, notificationEmail: true, locale: true } },
    },
  });

  return subscriptions.flatMap(({ user }) =>
    user.notificationEmail
      ? [
          {
            id: user.id,
            notificationEmail: user.notificationEmail,
            locale: user.locale,
          },
        ]
      : [],
  );
}
