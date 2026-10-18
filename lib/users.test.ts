import { describe, expect, test } from "bun:test";

import type { AppLocale } from "@/lib/i18n";

type UserRecord = {
  id: string;
  name: string | null;
  firstName: string | null;
  secondName: string | null;
  locale: AppLocale | null;
  email: string | null;
  image: string | null;
  notificationEmail: string | null;
};

type UserUpdateArgs = {
  where: { id: string };
  data: Record<string, string>;
};

let currentUser: UserRecord | null = null;
let updateCalls: UserUpdateArgs[] = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async () => currentUser,
      update: async (args: UserUpdateArgs) => {
        updateCalls.push(args);
        return currentUser ? { ...currentUser, ...args.data } : args.data;
      },
    },
  },
}));

const { syncAtprotoProfileFields, syncExternalProfileFields } =
  await import("@/lib/users");

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user-1",
    name: null,
    firstName: null,
    secondName: null,
    locale: null,
    email: null,
    image: null,
    notificationEmail: null,
    ...overrides,
  };
}

function resetTestState(overrides: Partial<UserRecord> = {}) {
  currentUser = user(overrides);
  updateCalls = [];
}

describe("syncAtprotoProfileFields", () => {
  test("initializes missing profile fields from ATProto profile data", async () => {
    resetTestState();

    await syncAtprotoProfileFields("user-1", {
      did: "did:plc:123",
      handle: "mona.example.com",
      displayName: "Mona Lisa",
      avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:123/avatar@jpeg",
    });

    expect(JSON.stringify(updateCalls)).toBe(
      JSON.stringify([
        {
          where: { id: "user-1" },
          data: {
            firstName: "Mona",
            secondName: "Lisa",
            name: "Mona Lisa",
            image:
              "https://cdn.bsky.app/img/avatar/plain/did:plc:123/avatar@jpeg",
          },
        },
      ]),
    );
  });

  test("falls back to handle when display name is missing", async () => {
    resetTestState();

    await syncAtprotoProfileFields("user-1", {
      did: "did:plc:123",
      handle: "octocat.bsky.social",
      avatar: "not-a-url",
    });

    expect(JSON.stringify(updateCalls)).toBe(
      JSON.stringify([
        {
          where: { id: "user-1" },
          data: {
            firstName: "octocat.bsky.social",
            name: "octocat.bsky.social",
          },
        },
      ]),
    );
  });

  test("falls back to DID when profile names are missing", async () => {
    resetTestState();

    await syncAtprotoProfileFields("user-1", {
      did: "did:plc:123",
    });

    expect(JSON.stringify(updateCalls)).toBe(
      JSON.stringify([
        {
          where: { id: "user-1" },
          data: {
            firstName: "did:plc:123",
            name: "did:plc:123",
          },
        },
      ]),
    );
  });

  test("preserves creator-managed profile fields, email, image, and locale", async () => {
    resetTestState({
      name: "Custom Name",
      firstName: "Custom",
      secondName: "Name",
      locale: "ru",
      email: "custom@example.com",
      image: "https://example.com/custom.png",
    });

    await syncAtprotoProfileFields("user-1", {
      did: "did:plc:123",
      handle: "mona.example.com",
      displayName: "Mona Lisa",
      avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:123/avatar@jpeg",
    });

    expect(JSON.stringify(updateCalls)).toBe(JSON.stringify([]));
  });
});

describe("syncExternalProfileFields", () => {
  test("initializes name parts, avatar, and notification email on first sign-in", async () => {
    resetTestState();

    await syncExternalProfileFields("user-1", {
      name: "Mona Lisa",
      image: "https://example.com/mona.png",
      email: "Mona@Example.com",
    });

    expect(JSON.stringify(updateCalls)).toBe(
      JSON.stringify([
        {
          where: { id: "user-1" },
          data: {
            firstName: "Mona",
            secondName: "Lisa",
            name: "Mona Lisa",
            image: "https://example.com/mona.png",
            notificationEmail: "mona@example.com",
          },
        },
      ]),
    );
  });

  test("prefers provided name parts and skips a missing email", async () => {
    resetTestState();

    await syncExternalProfileFields("user-1", {
      name: "Mona Lisa Smith",
      firstName: "Mona",
      secondName: "Lisa Smith",
      email: null,
    });

    expect(JSON.stringify(updateCalls)).toBe(
      JSON.stringify([
        {
          where: { id: "user-1" },
          data: {
            firstName: "Mona",
            secondName: "Lisa Smith",
            name: "Mona Lisa Smith",
          },
        },
      ]),
    );
  });

  test("keeps the edited name and notification email on a later sign-in", async () => {
    resetTestState({
      name: "Custom Name",
      firstName: "Custom",
      secondName: "Name",
      image: "https://example.com/custom.png",
      notificationEmail: "custom@example.com",
    });

    await syncExternalProfileFields("user-1", {
      name: "Mona Lisa",
      image: "https://example.com/mona.png",
      email: "mona@example.com",
    });

    expect(JSON.stringify(updateCalls)).toBe(JSON.stringify([]));
  });
});
