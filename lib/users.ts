import { db } from "@/lib/db";
import { AppLocale, DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n";
import { AppError } from "@/lib/errors";
import type { ProfileSettingsUserSummary } from "@/lib/form-types";
import { getComposedName, splitNameParts } from "@/lib/user-identity";
import { profileSettingsSchema } from "@/lib/validators";

function toProfileSettingsUserSummary(user: {
  id: string;
  name: string | null;
  firstName: string | null;
  secondName: string | null;
  locale: string | null;
  email: string | null;
  image: string | null;
}): ProfileSettingsUserSummary {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    secondName: user.secondName,
    locale: normalizeLocale(user.locale),
    email: user.email,
    image: user.image,
  };
}

export async function getProfileSettingsUser(userId: string): Promise<ProfileSettingsUserSummary> {
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
    },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return toProfileSettingsUserSummary(user);
}

export async function updateProfileSettings(userId: string, payload: { firstName: unknown; secondName: unknown; locale: unknown; image: unknown }) {
  const parsed = profileSettingsSchema.parse(payload);
  const name = getComposedName(parsed.firstName, parsed.secondName);

  return db.user.update({
    where: { id: userId },
    data: {
      name,
      firstName: parsed.firstName,
      secondName: parsed.secondName,
      locale: parsed.locale,
      image: parsed.image,
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      secondName: true,
      locale: true,
      email: true,
      image: true,
    },
  });
}

type GoogleProfilePayload = {
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
  locale?: string | null;
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

export async function syncGoogleProfileFields(
  userId: string,
  profile: GoogleProfilePayload | null | undefined,
) {
  if (!profile) {
    return;
  }

  const currentUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      firstName: true,
      secondName: true,
      locale: true,
      image: true,
    },
  });

  if (!currentUser) {
    return;
  }

  const parsedName = splitNameParts(clean(profile.name));
  const nextFirstName = clean(profile.given_name, 60) ?? parsedName.firstName;
  const nextSecondName = clean(profile.family_name, 60) ?? parsedName.secondName;
  const nextName = clean(profile.name) ?? getComposedName(nextFirstName, nextSecondName);
  const nextImage = normalizeImageUrl(profile.picture);
  const hasProvidedLocale = typeof profile.locale === "string" && profile.locale.trim().length > 0;
  const nextLocale = hasProvidedLocale ? normalizeLocale(profile.locale) : null;

  const data: {
    firstName?: string;
    secondName?: string;
    name?: string;
    locale?: AppLocale;
    image?: string;
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

  if (!currentUser.locale && hasProvidedLocale) {
    data.locale = nextLocale ?? DEFAULT_LOCALE;
  }

  if (!currentUser.image?.trim() && nextImage) {
    data.image = nextImage;
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await db.user.update({
    where: { id: userId },
    data,
  });
}
