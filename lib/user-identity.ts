export type UserIdentityLike = {
  name?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  email?: string | null;
  image?: string | null;
};

function clean(value: string | null | undefined) {
  const nextValue = value?.trim() ?? "";
  return nextValue || null;
}

export function getComposedName(firstName?: string | null, secondName?: string | null) {
  const composed = [clean(firstName), clean(secondName)].filter(Boolean).join(" ").trim();
  return composed || null;
}

export function splitNameParts(value?: string | null) {
  const source = clean(value);

  if (!source) {
    return { firstName: null, secondName: null };
  }

  const [firstName, ...rest] = source.split(/\s+/);
  return {
    firstName: clean(firstName),
    secondName: clean(rest.join(" ")),
  };
}

export function getUserDisplayName(user: UserIdentityLike) {
  return getComposedName(user.firstName, user.secondName) ?? clean(user.name) ?? clean(user.email)?.split("@")[0] ?? "User";
}

export function getUserImage(user: UserIdentityLike) {
  return clean(user.image);
}

export function getUserInitials(user: UserIdentityLike) {
  const firstName = clean(user.firstName);
  const secondName = clean(user.secondName);

  if (firstName && secondName) {
    return `${firstName[0]}${secondName[0]}`.toUpperCase();
  }

  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }

  const name = clean(user.name);

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }

    return parts[0]?.slice(0, 2).toUpperCase() ?? "U";
  }

  const emailLocalPart = clean(user.email)?.split("@")[0] ?? "U";
  return emailLocalPart.slice(0, 2).toUpperCase();
}
