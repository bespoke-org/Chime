import { removeReplacedAvatar } from "@/lib/avatars";
import { db } from "@/lib/db";
import { normalizeLocale, type AppLocale } from "@/lib/i18n";
import { AppError } from "@/lib/errors";
import type { ProfileSettingsUserSummary } from "@/lib/form-types";
import type { ExternalProfilePayload } from "@/lib/oidc-auth";
import { getComposedName, splitNameParts } from "@/lib/user-identity";
import { profileSettingsSchema } from "@/lib/validators";

function toProfileSettingsUserSummary(
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    secondName: string | null;
    locale: string | null;
    email: string | null;
    image: string | null;
    notificationEmail: string | null;
  },
  fallbackLocale: AppLocale,
): ProfileSettingsUserSummary {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    secondName: user.secondName,
    locale: user.locale ? normalizeLocale(user.locale) : fallbackLocale,
    email: user.email,
    image: user.image,
    notificationEmail: user.notificationEmail,
  };
}

export async function getProfileSettingsUser(
  userId: string,
  fallbackLocale: AppLocale,
): Promise<ProfileSettingsUserSummary> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      firstName: true,
      secondName: true,
      locale: true,
      email: true,
      image: true,
      notificationEmail: true,
    },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return toProfileSettingsUserSummary(user, fallbackLocale);
}

export async function updateProfileSettings(
  userId: string,
  payload: {
    firstName: unknown;
    secondName: unknown;
    locale: unknown;
    image: unknown;
    notificationEmail: unknown;
  },
) {
  const parsed = profileSettingsSchema.parse(payload);
  const name = getComposedName(parsed.firstName, parsed.secondName);
  const previous = await db.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });

  const user = await db.user.update({
    where: { id: userId },
    data: {
      name,
      firstName: parsed.firstName,
      secondName: parsed.secondName,
      locale: parsed.locale,
      image: parsed.image,
      notificationEmail: parsed.notificationEmail,
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      secondName: true,
      locale: true,
      email: true,
      image: true,
      notificationEmail: true,
    },
  });

  await removeReplacedAvatar(userId, previous?.image ?? null, user.image);
  return user;
}

type AtprotoProfilePayload = {
  did?: string | null;
  handle?: string | null;
  displayName?: string | null;
  avatar?: string | null;
};

function clean(value: string | null | undefined, maxLength = 120) {
  const nextValue = value?.trim() ?? "";
  return nextValue ? nextValue.slice(0, maxLength) : null;
}

function normalizeImageUrl(value: string | null | undefined) {
  const nextValue = clean(value, 2048);

  if (!nextValue) {
    return null;
  }

  try {
    const url = new URL(nextValue);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return nextValue;
    }
  } catch {
    return null;
  }

  return null;
}

type ProfileDefaults = {
  firstName: string | null;
  secondName: string | null;
  name: string | null;
  image: string | null | undefined;
  notificationEmail?: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  const nextValue = clean(value, 254)?.toLowerCase() ?? null;
  return nextValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextValue)
    ? nextValue
    : null;
}

async function applyProfileDefaults(userId: string, defaults: ProfileDefaults) {
  const currentUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      firstName: true,
      secondName: true,
      locale: true,
      email: true,
      image: true,
      notificationEmail: true,
    },
  });

  if (!currentUser) {
    return;
  }

  const nextFirstName = defaults.firstName;
  const nextSecondName = defaults.secondName;
  const nextName =
    defaults.name ?? getComposedName(nextFirstName, nextSecondName);
  const nextImage = normalizeImageUrl(defaults.image);
  const nextNotificationEmail = normalizeEmail(defaults.notificationEmail);

  const data: {
    firstName?: string;
    secondName?: string;
    name?: string;
    image?: string;
    notificationEmail?: string;
  } = {};

  if (!currentUser.firstName?.trim() && nextFirstName) {
    data.firstName = nextFirstName;
  }

  if (!currentUser.secondName?.trim() && nextSecondName) {
    data.secondName = nextSecondName;
  }

  if (!currentUser.name?.trim() && nextName) {
    data.name = nextName;
  }

  if (!currentUser.image?.trim() && nextImage) {
    data.image = nextImage;
  }

  if (!currentUser.notificationEmail?.trim() && nextNotificationEmail) {
    data.notificationEmail = nextNotificationEmail;
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await db.user.update({
    where: { id: userId },
    data,
  });
}

export async function syncAtprotoProfileFields(
  userId: string,
  profile: AtprotoProfilePayload | null | undefined,
) {
  if (!profile) {
    return;
  }

  const displayName =
    clean(profile.displayName) ?? clean(profile.handle) ?? clean(profile.did);
  const parsedName = splitNameParts(displayName);

  await applyProfileDefaults(userId, {
    firstName: parsedName.firstName,
    secondName: parsedName.secondName,
    name: displayName,
    image: profile.avatar,
  });
}

export async function syncExternalProfileFields(
  userId: string,
  profile: ExternalProfilePayload | null | undefined,
) {
  if (!profile) {
    return;
  }

  const name = clean(profile.name);
  const parsedName = splitNameParts(name);

  await applyProfileDefaults(userId, {
    firstName: clean(profile.firstName, 60) ?? parsedName.firstName,
    secondName: clean(profile.secondName, 60) ?? parsedName.secondName,
    name,
    image: profile.image,
    notificationEmail: profile.email,
  });
}
