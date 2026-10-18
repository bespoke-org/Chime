#!/usr/bin/env bash
# Prepares the local Garage container from compose.yaml: assigns the single
# node to the layout, creates the bucket and an access key, grants the key
# read/write on the bucket and sets the CORS rule the browser upload needs.
# Prints the credentials to paste into .env. Safe to run again.
set -euo pipefail

CONTAINER="${GARAGE_CONTAINER:-the-forms-garage}"
BUCKET="${S3_BUCKET:-lively-forms}"
KEY_NAME="${GARAGE_KEY_NAME:-lively-forms-dev}"
ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:3900}"
ORIGIN="${UPLOAD_CORS_ORIGIN:-http://127.0.0.1:3000}"

garage() {
  docker exec "${CONTAINER}" /garage "$@" 2>/dev/null
}

if ! garage status >/dev/null; then
  echo "Garage is not reachable in container ${CONTAINER}. Run 'bun run db:up' first." >&2
  exit 1
fi

if garage status | grep -q "NO ROLE ASSIGNED"; then
  NODE_ID="$(garage status | awk '/NO ROLE ASSIGNED/ { print $1; exit }')"
  garage layout assign -z dc1 -c 1G "${NODE_ID}" >/dev/null
  VERSION="$(garage layout show | awk '/--version/ { print $NF; exit }')"
  garage layout apply --version "${VERSION:-1}" >/dev/null
  echo "Layout applied for node ${NODE_ID}"
fi

if ! garage bucket info "${BUCKET}" >/dev/null; then
  garage bucket create "${BUCKET}" >/dev/null
  echo "Bucket ${BUCKET} created"
fi

if ! garage key info "${KEY_NAME}" >/dev/null; then
  garage key create "${KEY_NAME}" >/dev/null
  echo "Key ${KEY_NAME} created"
fi

# Owner is needed for PutBucketCors.
garage bucket allow --read --write --owner "${BUCKET}" --key "${KEY_NAME}" >/dev/null

KEY_INFO="$(garage key info "${KEY_NAME}" --show-secret)"
ACCESS_KEY_ID="$(printf '%s\n' "${KEY_INFO}" | awk '/^Key ID:/ { print $3 }')"
SECRET_ACCESS_KEY="$(printf '%s\n' "${KEY_INFO}" | awk '/^Secret key:/ { print $3 }')"

S3_ENDPOINT="${ENDPOINT}" \
S3_BUCKET="${BUCKET}" \
S3_ACCESS_KEY_ID="${ACCESS_KEY_ID}" \
S3_SECRET_ACCESS_KEY="${SECRET_ACCESS_KEY}" \
UPLOAD_CORS_ORIGIN="${ORIGIN}" \
  bun run scripts/garage-cors.ts

cat <<ENV

Add these lines to .env:

S3_ENDPOINT="${ENDPOINT}"
S3_PUBLIC_ENDPOINT="${ENDPOINT}"
S3_REGION="garage"
S3_BUCKET="${BUCKET}"
S3_ACCESS_KEY_ID="${ACCESS_KEY_ID}"
S3_SECRET_ACCESS_KEY="${SECRET_ACCESS_KEY}"
ENV
