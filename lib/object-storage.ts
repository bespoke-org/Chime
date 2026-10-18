import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ObjectStorageConfig = {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function readString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

// Plain S3 with path-style addressing, so Garage, MinIO, Ceph or AWS all
// work. S3_PUBLIC_ENDPOINT is what the browser reaches for presigned URLs;
// it defaults to the server-side endpoint.
export function getObjectStorageConfig(
  env: Record<string, string | undefined> = process.env,
): ObjectStorageConfig | null {
  const endpoint = readString(env.S3_ENDPOINT);
  const bucket = readString(env.S3_BUCKET);
  const accessKeyId = readString(env.S3_ACCESS_KEY_ID);
  const secretAccessKey = readString(env.S3_SECRET_ACCESS_KEY);

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    publicEndpoint: (readString(env.S3_PUBLIC_ENDPOINT) ?? endpoint).replace(
      /\/+$/,
      "",
    ),
    region: readString(env.S3_REGION) ?? "garage",
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export function isObjectStorageConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return getObjectStorageConfig(env) !== null;
}

// Without WHEN_REQUIRED the SDK adds an x-amz-checksum-crc32 parameter to
// presigned PUT URLs; the browser cannot supply that checksum and Garage
// rejects the body with InvalidDigest.
function createClient(config: ObjectStorageConfig, endpoint: string) {
  return new S3Client({
    endpoint,
    region: config.region,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function createObjectStorageClient(
  config: ObjectStorageConfig | null = getObjectStorageConfig(),
) {
  if (!config) {
    throw new Error("Object storage is not configured.");
  }

  return createClient(config, config.endpoint);
}

export type ObjectHead = {
  size: number;
  contentType: string;
};

export type ObjectStorage = {
  createUploadUrl: (input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }) => Promise<string>;
  createDownloadUrl: (input: {
    key: string;
    filename: string;
    expiresInSeconds: number;
  }) => Promise<string>;
  headObject: (key: string) => Promise<ObjectHead | null>;
  deleteObject: (key: string) => Promise<void>;
};

// RFC 8187 encoding for the filename parameter, so any Unicode name
// survives the Content-Disposition header.
export function encodeContentDispositionFilename(filename: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// Presigned URLs are signed by a second client that points at the public
// endpoint: the signature covers the host, so rewriting it afterwards would
// invalidate the URL.
export function createObjectStorage(
  config: ObjectStorageConfig,
  clients: { internal?: S3Client; publicFacing?: S3Client } = {},
): ObjectStorage {
  const internal = clients.internal ?? createClient(config, config.endpoint);
  const publicFacing =
    clients.publicFacing ?? createClient(config, config.publicEndpoint);

  return {
    async createUploadUrl(input) {
      return getSignedUrl(
        publicFacing,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          ContentType: input.contentType,
          ContentLength: input.contentLength,
        }),
        { expiresIn: input.expiresInSeconds },
      );
    },

    async createDownloadUrl(input) {
      return getSignedUrl(
        publicFacing,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          ResponseContentDisposition: encodeContentDispositionFilename(
            input.filename,
          ),
        }),
        { expiresIn: input.expiresInSeconds },
      );
    },

    async headObject(key) {
      try {
        const head = await internal.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        );

        return {
          size: head.ContentLength ?? 0,
          contentType: head.ContentType ?? "application/octet-stream",
        };
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "NotFound" || error.name === "NoSuchKey")
        ) {
          return null;
        }

        throw error;
      }
    },

    async deleteObject(key) {
      await internal.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    },
  };
}

let activeStorage: ObjectStorage | null = null;

// Returns null when the S3_* variables are missing so callers can answer with
// a clear "not configured" error instead of failing on the first request.
export function getObjectStorage(): ObjectStorage | null {
  if (activeStorage) {
    return activeStorage;
  }

  const config = getObjectStorageConfig();

  if (!config) {
    return null;
  }

  activeStorage = createObjectStorage(config);
  return activeStorage;
}

// Tests swap the storage so upload flows run without a bucket.
export function setObjectStorage(storage: ObjectStorage | null) {
  activeStorage = storage;
}
