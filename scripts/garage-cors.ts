// Sets the CORS rule on the upload bucket so a browser on the app origin can
// PUT files to presigned URLs. Reads the S3_* variables and UPLOAD_CORS_ORIGIN
// (comma separated origins, default http://127.0.0.1:3000). Works against any
// S3-compatible endpoint, not only Garage.
import { PutBucketCorsCommand } from "@aws-sdk/client-s3";

import { createObjectStorageClient } from "../lib/object-storage";

const origins = (process.env.UPLOAD_CORS_ORIGIN ?? "http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const bucket = process.env.S3_BUCKET;

if (!bucket) {
  console.error("S3_BUCKET is not set.");
  process.exit(1);
}

await createObjectStorageClient().send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ["PUT", "GET"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

console.log(`CORS rule set on ${bucket} for ${origins.join(", ")}`);
