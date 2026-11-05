import { describe, expect, test } from "bun:test";

import {
  createObjectStorage,
  encodeContentDispositionFilename,
  getObjectStorageConfig,
  isObjectStorageConfigured,
} from "@/lib/object-storage";

const env = {
  S3_ENDPOINT: "http://garage:3900/",
  S3_PUBLIC_ENDPOINT: "https://files.example.com",
  S3_BUCKET: "chime",
  S3_ACCESS_KEY_ID: "GK0123",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("getObjectStorageConfig", () => {
  test("reads the S3 variables with defaults", () => {
    expect(JSON.stringify(getObjectStorageConfig(env))).toBe(
      JSON.stringify({
        endpoint: "http://garage:3900",
        publicEndpoint: "https://files.example.com",
        region: "garage",
        bucket: "chime",
        accessKeyId: "GK0123",
        secretAccessKey: "secret",
      }),
    );
  });

  test("the public endpoint defaults to the internal one", () => {
    const { S3_PUBLIC_ENDPOINT: _unused, ...rest } = env;
    void _unused;
    expect(getObjectStorageConfig(rest)?.publicEndpoint).toBe(
      "http://garage:3900",
    );
    expect(
      getObjectStorageConfig({ ...rest, S3_REGION: "us-east-1" })?.region,
    ).toBe("us-east-1");
  });

  test("is not configured when a variable is missing", () => {
    expect(isObjectStorageConfigured(env)).toBe(true);
    expect(isObjectStorageConfigured({ ...env, S3_BUCKET: " " })).toBe(false);
    expect(isObjectStorageConfigured({})).toBe(false);
  });

  test("production requires the public endpoint", () => {
    const { S3_PUBLIC_ENDPOINT: _unused, ...rest } = env;
    void _unused;
    expect(isObjectStorageConfigured({ ...rest, NODE_ENV: "production" })).toBe(
      false,
    );
    expect(getObjectStorageConfig({ ...rest, NODE_ENV: "production" })).toBe(
      null,
    );
    expect(isObjectStorageConfigured({ ...env, NODE_ENV: "production" })).toBe(
      true,
    );
    expect(
      isObjectStorageConfigured({ ...rest, NODE_ENV: "development" }),
    ).toBe(true);
  });
});

describe("presigned URLs", () => {
  const storage = createObjectStorage(getObjectStorageConfig(env)!);

  test("the upload URL points at the public endpoint with a path-style bucket", async () => {
    const url = new URL(
      await storage.createUploadUrl({
        key: "forms/f/b/u/cv.pdf",
        contentType: "application/pdf",
        contentLength: 10,
        expiresInSeconds: 600,
      }),
    );

    expect(url.origin).toBe("https://files.example.com");
    expect(url.pathname).toBe("/chime/forms/f/b/u/cv.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.has("X-Amz-Signature")).toBe(true);
    // The browser cannot compute SDK checksums, so none may be required.
    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-length",
    );
  });

  test("the download URL carries an attachment disposition with the filename", async () => {
    const url = new URL(
      await storage.createDownloadUrl({
        key: "forms/f/b/u/cv.pdf",
        filename: "резюме.pdf",
        expiresInSeconds: 300,
      }),
    );

    expect(url.origin).toBe("https://files.example.com");
    expect(url.searchParams.get("response-content-disposition")).toBe(
      "attachment; filename*=UTF-8''%D1%80%D0%B5%D0%B7%D1%8E%D0%BC%D0%B5.pdf",
    );
  });

  test("encodes the disposition filename per RFC 8187", () => {
    expect(encodeContentDispositionFilename('a "b" c.txt')).toBe(
      "attachment; filename*=UTF-8''a%20%22b%22%20c.txt",
    );
  });
});
