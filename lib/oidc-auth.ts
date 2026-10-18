type Env = Record<string, string | undefined>;

export type OidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  name: string;
  iconUrl: string | null;
  scope: string;
};

export type OAuthClientConfig = {
  clientId: string;
  clientSecret: string;
};

export type SignInProviderId = "google" | "github" | "oidc";

export type SignInProviderOption = {
  id: SignInProviderId;
  label: string;
  iconUrl?: string;
};

export type ExternalProfilePayload = {
  name?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  image?: string | null;
  email?: string | null;
};

export const DEFAULT_OIDC_PROVIDER_NAME = "SSO";
export const DEFAULT_OIDC_SCOPE = "openid profile email";

function read(env: Env, key: string) {
  const value = env[key]?.trim();
  return value ? value : null;
}

export function getOidcConfig(env: Env): OidcConfig | null {
  const issuer = read(env, "OIDC_ISSUER");
  const clientId = read(env, "OIDC_CLIENT_ID");
  const clientSecret = read(env, "OIDC_CLIENT_SECRET");

  if (!issuer || !clientId || !clientSecret) {
    return null;
  }

  return {
    issuer: issuer.replace(/\/+$/, ""),
    clientId,
    clientSecret,
    name: read(env, "OIDC_PROVIDER_NAME") ?? DEFAULT_OIDC_PROVIDER_NAME,
    iconUrl: read(env, "OIDC_PROVIDER_ICON_URL"),
    scope: read(env, "OIDC_SCOPE") ?? DEFAULT_OIDC_SCOPE,
  };
}

function getOAuthClientConfig(env: Env, prefix: string) {
  const clientId = read(env, `${prefix}_CLIENT_ID`);
  const clientSecret = read(env, `${prefix}_CLIENT_SECRET`);

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getGoogleConfig(env: Env): OAuthClientConfig | null {
  return getOAuthClientConfig(env, "GOOGLE");
}

export function getGithubConfig(env: Env): OAuthClientConfig | null {
  return getOAuthClientConfig(env, "GITHUB");
}

export function getSignInProviderOptions(env: Env): SignInProviderOption[] {
  const options: SignInProviderOption[] = [];

  if (getGoogleConfig(env)) {
    options.push({ id: "google", label: "Google" });
  }

  if (getGithubConfig(env)) {
    options.push({ id: "github", label: "GitHub" });
  }

  const oidc = getOidcConfig(env);

  if (oidc) {
    options.push({
      id: "oidc",
      label: oidc.name,
      ...(oidc.iconUrl ? { iconUrl: oidc.iconUrl } : {}),
    });
  }

  return options;
}

type Claims = object;

function claim(profile: Claims | null | undefined, key: string) {
  const value = (profile as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function mapOidcProfile(profile: Claims) {
  return {
    id: String(claim(profile, "sub")),
    name: claim(profile, "name") ?? claim(profile, "preferred_username"),
    email: claim(profile, "email"),
    image: claim(profile, "picture"),
  };
}

export function getExternalProfile(
  providerId: string,
  profile: Claims | null | undefined,
): ExternalProfilePayload | null {
  switch (providerId) {
    case "google":
      return {
        name: claim(profile, "name"),
        firstName: claim(profile, "given_name"),
        secondName: claim(profile, "family_name"),
        image: claim(profile, "picture"),
        email: claim(profile, "email"),
      };
    case "github":
      return {
        name: claim(profile, "name") ?? claim(profile, "login"),
        image: claim(profile, "avatar_url"),
        email: claim(profile, "email"),
      };
    case "oidc": {
      const mapped = mapOidcProfile(profile ?? {});
      return { name: mapped.name, image: mapped.image, email: mapped.email };
    }
    default:
      return null;
  }
}

// Columns of the Account model. Identity providers add their own token
// fields (Keycloak sends refresh_expires_in and not-before-policy), and the
// Prisma adapter would try to write them as columns.
const ACCOUNT_COLUMNS = [
  "userId",
  "type",
  "provider",
  "providerAccountId",
  "refresh_token",
  "access_token",
  "expires_at",
  "token_type",
  "scope",
  "id_token",
  "session_state",
  "refresh_token_expires_in",
] as const;

export function pickAccountColumns<T extends Record<string, unknown>>(
  account: T,
) {
  return Object.fromEntries(
    Object.entries(account).filter(([key]) =>
      (ACCOUNT_COLUMNS as readonly string[]).includes(key),
    ),
  ) as Pick<T, Extract<keyof T, (typeof ACCOUNT_COLUMNS)[number]>>;
}
