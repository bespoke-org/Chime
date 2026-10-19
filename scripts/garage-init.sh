#!/usr/bin/env bash
# Prepares the Garage container from compose.yaml: assigns the single node to
# the layout, creates the bucket and an access key, grants the key read/write
# on the bucket and sets the CORS rule the browser upload needs. Uses podman
# when it is installed, otherwise docker. Safe to run again.
#
# Without GARAGE_ENV_FILE the credentials are printed to paste into .env.
# With GARAGE_ENV_FILE=.env they are written into that file instead: the
# endpoint, region and bucket are set, the key id and secret only when the
# file does not have them yet, and nothing secret is printed.
set -euo pipefail

CONTAINER="${GARAGE_CONTAINER:-lively-forms-garage}"
BUCKET="${S3_BUCKET:-lively-forms}"
KEY_NAME="${GARAGE_KEY_NAME:-lively-forms-dev}"
ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:3900}"
ORIGIN="${UPLOAD_CORS_ORIGIN:-http://127.0.0.1:3000}"
ENV_FILE="${GARAGE_ENV_FILE:-}"

if command -v podman >/dev/null 2>&1; then
  RUNTIME=podman
else
  RUNTIME=docker
fi

garage() {
  "${RUNTIME}" exec "${CONTAINER}" /garage "$@" 2>/dev/null
}

# Drops the (possibly commented) assignment of a key from the env file.
drop_env_key() {
  local tmp
  tmp="$(mktemp)"
  grep -v -E "^#? ?$1=" "$2" > "${tmp}" || true
  cat "${tmp}" > "$2"
  rm -f "${tmp}"
}

for _ in $(seq 1 30); do
  if garage status >/dev/null; then
    break
  fi
  sleep 1
done

if ! garage status >/dev/null; then
  echo "Garage is not reachable in container ${CONTAINER}. Run 'bun run db:up' first." >&2
  exit 1
fi

# The readers consume all of the output: closing the pipe early would end
# the podman exec with SIGPIPE and fail the pipeline. A role staged by an
# earlier interrupted run is applied as well.
NODE_ID="$(garage status | awk '/NO ROLE ASSIGNED/ && !found { print $1; found = 1 }')"
if [ -n "${NODE_ID}" ]; then
  garage layout assign -z dc1 -c 1G "${NODE_ID}" >/dev/null
fi
LAYOUT="$(garage layout show)"
if printf '%s\n' "${LAYOUT}" | grep 'STAGED ROLE CHANGES' >/dev/null; then
  VERSION="$(printf '%s\n' "${LAYOUT}" | awk '/layout apply --version/ { version = $NF } END { print version }')"
  garage layout apply --version "${VERSION:-1}" >/dev/null
  echo "Layout version ${VERSION:-1} applied"
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

if [ -n "${ENV_FILE}" ]; then
  # The key pair in the file wins over the one Garage reports, so a key made
  # by hand is kept; the CORS call below still uses the file's values. A pair
  # Garage no longer knows (the volume was recreated) is replaced.
  FILE_KEY_ID="$(sed -n 's/^S3_ACCESS_KEY_ID=//p' "${ENV_FILE}" | tr -d '"' | head -n 1)"
  if [ -n "${FILE_KEY_ID}" ] && grep -q '^S3_SECRET_ACCESS_KEY=' "${ENV_FILE}" && garage key info "${FILE_KEY_ID}" >/dev/null; then
    ACCESS_KEY_ID="${FILE_KEY_ID}"
    SECRET_ACCESS_KEY="$(sed -n 's/^S3_SECRET_ACCESS_KEY=//p' "${ENV_FILE}" | tr -d '"' | head -n 1)"
    echo "Kept S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY from ${ENV_FILE}"
  else
    drop_env_key S3_ACCESS_KEY_ID "${ENV_FILE}"
    drop_env_key S3_SECRET_ACCESS_KEY "${ENV_FILE}"
    printf 'S3_ACCESS_KEY_ID="%s"\nS3_SECRET_ACCESS_KEY="%s"\n' "${ACCESS_KEY_ID}" "${SECRET_ACCESS_KEY}" >> "${ENV_FILE}"
    echo "Wrote S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY to ${ENV_FILE}"
  fi
  for pair in "S3_ENDPOINT=${ENDPOINT}" "S3_REGION=garage" "S3_BUCKET=${BUCKET}"; do
    key="${pair%%=*}"
    drop_env_key "${key}" "${ENV_FILE}"
    printf '%s="%s"\n' "${key}" "${pair#*=}" >> "${ENV_FILE}"
  done
  echo "Set S3_ENDPOINT, S3_REGION and S3_BUCKET in ${ENV_FILE}"
fi

S3_ENDPOINT="${ENDPOINT}" \
S3_PUBLIC_ENDPOINT="${ENDPOINT}" \
S3_BUCKET="${BUCKET}" \
S3_ACCESS_KEY_ID="${ACCESS_KEY_ID}" \
S3_SECRET_ACCESS_KEY="${SECRET_ACCESS_KEY}" \
UPLOAD_CORS_ORIGIN="${ORIGIN}" \
  bun run scripts/garage-cors.ts

if [ -n "${ENV_FILE}" ]; then
  exit 0
fi

cat <<ENV

Add these lines to .env:

S3_ENDPOINT="${ENDPOINT}"
S3_PUBLIC_ENDPOINT="${ENDPOINT}"
S3_REGION="garage"
S3_BUCKET="${BUCKET}"
S3_ACCESS_KEY_ID="${ACCESS_KEY_ID}"
S3_SECRET_ACCESS_KEY="${SECRET_ACCESS_KEY}"
ENV
