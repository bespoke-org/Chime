import { describe, expect, test } from "bun:test";

type Event = { kind: "select" | "owner" | "object"; detail: unknown };

let storedKeys: string[] = [];
let events: Event[] = [];
let failingKeys: string[] = [];

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    upload: {
      findMany: async (args: { where: unknown }) => {
        events.push({ kind: "select", detail: args.where });
        return storedKeys.map((key) => ({ key }));
      },
    },
  },
}));

const { buildUploadOwnerWhere, deleteStoredObjects, removeUploadsFor } =
  await import("@/lib/upload-cleanup");
const { setObjectStorage } = await import("@/lib/object-storage");

const fakeStorage = {
  createUploadUrl: async () => "",
  createDownloadUrl: async () => "",
  headObject: async () => null,
  deleteObject: async (key: string) => {
    events.push({ kind: "object", detail: key });
    if (failingKeys.includes(key)) {
      throw new Error("storage down");
    }
  },
};

function reset(keys: string[], failing: string[] = []) {
  storedKeys = keys;
  failingKeys = failing;
  events = [];
  setObjectStorage(fakeStorage);
}

async function deleteOwner() {
  events.push({ kind: "owner", detail: null });
}

const S3_VARS = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

async function withoutStorageEnv(fn: () => Promise<void>) {
  const saved = S3_VARS.map((name) => [name, process.env[name]] as const);
  for (const name of S3_VARS) {
    delete process.env[name];
  }
  setObjectStorage(null);

  try {
    await fn();
  } finally {
    for (const [name, value] of saved) {
      if (value !== undefined) {
        process.env[name] = value;
      }
    }
    setObjectStorage(null);
  }
}

describe("buildUploadOwnerWhere", () => {
  test("selects by form, block or the organization of the form", () => {
    expect(JSON.stringify(buildUploadOwnerWhere({ formId: "f" }))).toBe(
      JSON.stringify({ formId: "f" }),
    );
    expect(JSON.stringify(buildUploadOwnerWhere({ blockId: "b" }))).toBe(
      JSON.stringify({ blockId: "b" }),
    );
    expect(JSON.stringify(buildUploadOwnerWhere({ organizationId: "o" }))).toBe(
      JSON.stringify({ form: { organizationId: "o" } }),
    );
  });
});

describe("deleteStoredObjects", () => {
  test("keeps going after a failed key and reports both counts", async () => {
    reset([], ["k2"]);
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message: unknown) => {
      warnings.push(String(message));
    };

    try {
      const result = await deleteStoredObjects(["k1", "k2", "k3"]);

      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(1);
      expect(events.map((event) => event.detail).join(",")).toBe("k1,k2,k3");
      expect(warnings.length).toBe(1);
      expect(warnings[0]).not.toContain("k2");
      expect(warnings[0]).toContain("of 3");
    } finally {
      console.warn = originalWarn;
    }
  });

  test("skips silently when storage is not configured", async () => {
    reset([]);
    await withoutStorageEnv(async () => {
      const result = await deleteStoredObjects(["k1"]);

      expect(result.deleted).toBe(0);
      expect(result.failed).toBe(0);
      expect(events.length).toBe(0);
    });
  });
});

describe("removeUploadsFor", () => {
  test("reads the keys, runs the owner delete, then removes the objects", async () => {
    reset(["a", "b"]);

    const result = await removeUploadsFor({ formId: "form-1" }, deleteOwner);

    expect(events.map((event) => event.kind).join(",")).toBe(
      "select,owner,object,object",
    );
    expect(JSON.stringify(events[0].detail)).toBe(
      JSON.stringify({ formId: "form-1" }),
    );
    expect(result.deleted).toBe(2);
  });

  test("a failing object does not undo the owner delete", async () => {
    reset(["a", "b"], ["a"]);
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const result = await removeUploadsFor(
        { blockId: "block-1" },
        deleteOwner,
      );

      expect(events.filter((event) => event.kind === "owner").length).toBe(1);
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(1);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("still deletes the owner when storage is not configured", async () => {
    reset(["a"]);
    await withoutStorageEnv(async () => {
      const result = await removeUploadsFor(
        { organizationId: "org-1" },
        deleteOwner,
      );

      expect(events.map((event) => event.kind).join(",")).toBe("owner");
      expect(result.deleted).toBe(0);
    });
  });
});
