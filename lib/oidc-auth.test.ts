import { describe, expect, test } from "bun:test";

import {
  getExternalProfile,
  getGithubConfig,
  getGoogleConfig,
  getOidcConfig,
  getSignInProviderOptions,
  mapOidcProfile,
  pickAccountColumns,
} from "@/lib/oidc-auth";

const oidcEnv = {
  OIDC_ISSUER: "https://auth.example.com/realms/master/",
  OIDC_CLIENT_ID: "chime",
  OIDC_CLIENT_SECRET: "secret",
};

describe("getOidcConfig", () => {
  test("returns the config with defaults and a trimmed issuer", () => {
    expect(JSON.stringify(getOidcConfig(oidcEnv))).toBe(
      JSON.stringify({
        issuer: "https://auth.example.com/realms/master",
        clientId: "chime",
        clientSecret: "secret",
        name: "SSO",
        iconUrl: null,
        scope: "openid profile email",
      }),
    );
  });

  test("uses the configured name and scope", () => {
    const config = getOidcConfig({
      ...oidcEnv,
      OIDC_PROVIDER_NAME: "Example University",
      OIDC_SCOPE: "openid email",
    });

    expect(config?.name).toBe("Example University");
    expect(config?.scope).toBe("openid email");
  });

  test("returns null when any required variable is missing or blank", () => {
    expect(getOidcConfig({ ...oidcEnv, OIDC_ISSUER: undefined })).toBe(null);
    expect(getOidcConfig({ ...oidcEnv, OIDC_CLIENT_ID: " " })).toBe(null);
    expect(getOidcConfig({ ...oidcEnv, OIDC_CLIENT_SECRET: "" })).toBe(null);
  });
});

describe("getGoogleConfig and getGithubConfig", () => {
  test("return the client pair only when both variables are set", () => {
    expect(
      JSON.stringify(
        getGoogleConfig({ GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" }),
      ),
    ).toBe(JSON.stringify({ clientId: "g", clientSecret: "s" }));
    expect(getGoogleConfig({ GOOGLE_CLIENT_ID: "g" })).toBe(null);
    expect(
      JSON.stringify(
        getGithubConfig({ GITHUB_CLIENT_ID: "h", GITHUB_CLIENT_SECRET: "s" }),
      ),
    ).toBe(JSON.stringify({ clientId: "h", clientSecret: "s" }));
    expect(getGithubConfig({ GITHUB_CLIENT_SECRET: "s" })).toBe(null);
  });
});

describe("getSignInProviderOptions", () => {
  test("lists enabled providers in a fixed order with their labels", () => {
    const options = getSignInProviderOptions({
      ...oidcEnv,
      OIDC_PROVIDER_NAME: "Example University",
      GITHUB_CLIENT_ID: "h",
      GITHUB_CLIENT_SECRET: "s",
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "s",
    });

    expect(JSON.stringify(options)).toBe(
      JSON.stringify([
        { id: "google", label: "Google" },
        { id: "github", label: "GitHub" },
        { id: "oidc", label: "Example University" },
      ]),
    );
  });

  test("is empty when nothing is configured", () => {
    expect(getSignInProviderOptions({}).length).toBe(0);
  });
});

describe("mapOidcProfile", () => {
  test("maps the standard claims", () => {
    expect(
      JSON.stringify(
        mapOidcProfile({
          sub: "abc",
          name: "Mona Lisa",
          preferred_username: "mona",
          email: "mona@example.com",
          picture: "https://example.com/mona.png",
        }),
      ),
    ).toBe(
      JSON.stringify({
        id: "abc",
        name: "Mona Lisa",
        email: "mona@example.com",
        image: "https://example.com/mona.png",
      }),
    );
  });

  test("falls back to preferred_username and null picture", () => {
    expect(
      JSON.stringify(
        mapOidcProfile({ sub: "abc", preferred_username: "mona" }),
      ),
    ).toBe(
      JSON.stringify({ id: "abc", name: "mona", email: null, image: null }),
    );
  });
});

describe("getExternalProfile", () => {
  test("maps Google name parts, picture, and email", () => {
    expect(
      JSON.stringify(
        getExternalProfile("google", {
          name: "Mona Lisa",
          given_name: "Mona",
          family_name: "Lisa",
          picture: "https://example.com/mona.png",
          email: "mona@example.com",
        }),
      ),
    ).toBe(
      JSON.stringify({
        name: "Mona Lisa",
        firstName: "Mona",
        secondName: "Lisa",
        image: "https://example.com/mona.png",
        email: "mona@example.com",
      }),
    );
  });

  test("maps GitHub login and avatar, keeping a hidden email null", () => {
    expect(
      JSON.stringify(
        getExternalProfile("github", {
          login: "octocat",
          name: null,
          avatar_url: "https://avatars.example.com/octocat",
          email: null,
        }),
      ),
    ).toBe(
      JSON.stringify({
        name: "octocat",
        image: "https://avatars.example.com/octocat",
        email: null,
      }),
    );
  });

  test("returns null for an unknown provider", () => {
    expect(getExternalProfile("atproto", { name: "x" })).toBe(null);
  });
});

describe("pickAccountColumns", () => {
  test("drops provider-specific token fields the Account model lacks", () => {
    const picked = pickAccountColumns({
      userId: "user-1",
      type: "oauth",
      provider: "oidc",
      providerAccountId: "sub-1",
      access_token: "a",
      refresh_token: "r",
      expires_at: 1,
      refresh_expires_in: 1800,
      "not-before-policy": 0,
      session_state: "s",
      scope: "openid",
      id_token: "i",
      token_type: "Bearer",
    });

    expect(JSON.stringify(Object.keys(picked).sort())).toBe(
      JSON.stringify(
        [
          "access_token",
          "expires_at",
          "id_token",
          "provider",
          "providerAccountId",
          "refresh_token",
          "scope",
          "session_state",
          "token_type",
          "type",
          "userId",
        ].sort(),
      ),
    );
  });
});

describe("OIDC provider icon", () => {
  test("passes the icon url through to the sign-in option when set", () => {
    const [option] = getSignInProviderOptions({
      ...oidcEnv,
      OIDC_PROVIDER_ICON_URL: "https://example.edu/logo.svg",
    });

    expect(option?.iconUrl).toBe("https://example.edu/logo.svg");
  });

  test("omits the icon url when the variable is empty", () => {
    const [option] = getSignInProviderOptions({
      ...oidcEnv,
      OIDC_PROVIDER_ICON_URL: "  ",
    });

    expect(JSON.stringify(option)).toBe(
      JSON.stringify({ id: "oidc", label: "SSO" }),
    );
  });
});
