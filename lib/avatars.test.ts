import { describe, expect, test } from "bun:test";

let currentImage: string | null = null;
let headResult: { size: number; contentType: string } | null = null;
let deletedKeys: string[] = [];
let signedUploads: Array<{ key: string; contentType: string }> = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async () => ({ image: currentImage }),
      findFirst: async (args: { where: { id: string; image: string } }) =>
        args.where.image === currentImage ? { id: args.where.id } : null,
      update: async (args: { data: { image: string } }) => {
        currentImage = args.data.image;
        return { image: currentImage };
      },
    },
  },
}));

const {
  confirmAvatarUpload,
  getAvatarDownloadUrl,
  removeReplacedAvatar,
  requestAvatarUpload,
} = await import("@/lib/avatars");
const { profileSettingsSchema } = await import("@/lib/validators");
const { setObjectStorage } = await import("@/lib/object-storage");

const uploadId = "0123456789abcdef0123456789abcdef";
const otherUploadId = "fedcba9876543210fedcba9876543210";

// Other test files install their own storage, so each test sets it again.
function reset() {
  currentImage = null;
  headResult = null;
  deletedKeys = [];
  signedUploads = [];
  setObjectStorage({
    createUploadUrl: async (input) => {
      signedUploads.push(input);
      return `https://storage.test/${input.key}?signed`;
    },
    createDownloadUrl: async (input) =>
      `https://storage.test/${input.key}?download`,
    headObject: async () => headResult,
    deleteObject: async (key) => {
      deletedKeys.push(key);
    },
  });
}

async function errorMessage(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("avatars", () => {
  test("signs an upload under the user's avatar prefix", async () => {
    reset();
    const result = await requestAvatarUpload("user-1", {
      contentType: "image/png",
      size: 1000,
    });

    expect(
      /^avatars\/user-1\/[0-9a-f]{32}$/.test(signedUploads[0]?.key ?? ""),
    ).toBe(true);
    expect(result.headers["content-type"]).toBe("image/png");
  });

  test("rejects other types and files over 2 MB before signing", async () => {
    reset();
    expect(
      await errorMessage(
        requestAvatarUpload("user-1", { contentType: "image/gif", size: 10 }),
      ),
    ).toContain("JPEG, PNG or WebP");
    expect(
      await errorMessage(
        requestAvatarUpload("user-1", {
          contentType: "image/jpeg",
          size: 2 * 1024 * 1024 + 1,
        }),
      ),
    ).toContain("JPEG, PNG or WebP");
    expect(signedUploads.length).toBe(0);
  });

  test("sets the confirmed upload as avatar and deletes the previous one", async () => {
    reset();
    currentImage = `/api/avatars/user-1/${otherUploadId}`;
    headResult = { size: 1000, contentType: "image/webp" };

    const result = await confirmAvatarUpload("user-1", uploadId);

    expect(result.image).toBe(`/api/avatars/user-1/${uploadId}`);
    expect(currentImage).toBe(`/api/avatars/user-1/${uploadId}`);
    expect(deletedKeys.join(",")).toBe(`avatars/user-1/${otherUploadId}`);
  });

  test("deletes a stored object that does not match the limits", async () => {
    reset();
    headResult = { size: 3 * 1024 * 1024, contentType: "image/png" };

    expect(
      await errorMessage(confirmAvatarUpload("user-1", uploadId)),
    ).toContain("JPEG, PNG or WebP");
    expect(deletedKeys.join(",")).toBe(`avatars/user-1/${uploadId}`);
    expect(currentImage).toBe(null);
  });

  test("answers 404 when nothing was uploaded", async () => {
    reset();
    expect(
      await errorMessage(confirmAvatarUpload("user-1", uploadId)),
    ).toContain("Upload not found.");
    expect(await errorMessage(confirmAvatarUpload("user-1", "../x"))).toContain(
      "Upload not found.",
    );
  });

  test("never deletes another user's avatar or an external image", async () => {
    reset();
    await removeReplacedAvatar(
      "user-1",
      `/api/avatars/user-2/${uploadId}`,
      "https://example.com/a.png",
    );
    await removeReplacedAvatar(
      "user-1",
      "https://example.com/a.png",
      "https://example.com/b.png",
    );
    expect(deletedKeys.length).toBe(0);
  });

  test("serves only the user's current avatar", async () => {
    reset();
    currentImage = `/api/avatars/user-1/${uploadId}`;

    expect(await getAvatarDownloadUrl("user-1", uploadId)).toBe(
      `https://storage.test/avatars/user-1/${uploadId}?download`,
    );
    expect(
      await errorMessage(getAvatarDownloadUrl("user-1", otherUploadId)),
    ).toContain("Avatar not found.");
  });

  test("profile settings accept an uploaded avatar path", () => {
    reset();
    const parsed = profileSettingsSchema.safeParse({
      image: `/api/avatars/user-1/${uploadId}`,
    });

    expect(parsed.success).toBe(true);
    expect(
      profileSettingsSchema.safeParse({ image: "/api/other" }).success,
    ).toBe(false);
  });
});
