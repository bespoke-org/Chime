#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@10.72.30.114}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/lively-forms}"
PORT="${PORT:-8000}"
# Stage is public at forms.alivetech.org. Caddy terminates HTTPS there and
# proxies requests over the private network to http://10.72.30.114:8000.
# OAuth URLs must always use the public HTTPS origin, never the upstream URL.
PUBLIC_URL="${PUBLIC_URL:-https://forms.alivetech.org}"
PROXY_UPSTREAM="${PROXY_UPSTREAM:-http://10.72.30.114:8000}"
SERVICE_NAME="${SERVICE_NAME:-lively-forms}"
# RESET_DB=1 drops the compose volumes before starting them, so the migrations
# apply to an empty database. Everything stored on the server is lost.
RESET_DB="${RESET_DB:-0}"
# ENABLE_STORAGE=0 skips the Garage setup (layout, bucket, key, CORS, S3_* in .env).
ENABLE_STORAGE="${ENABLE_STORAGE:-1}"
# Browsers upload straight to Garage, so the gate exposes it at this HTTPS
# origin (proxied to 10.72.30.114:3900). Written to .env as S3_PUBLIC_ENDPOINT.
STORAGE_PUBLIC_URL="${STORAGE_PUBLIC_URL:-https://storage.forms.alivetech.org}"
# SYNC_PROVIDER_ENV=1 copies the OIDC_*, GITHUB_* and GOOGLE_* lines of the
# local .env into the server .env, replacing the keys that are already there.
SYNC_PROVIDER_ENV="${SYNC_PROVIDER_ENV:-0}"

echo "Deploying to ${DEPLOY_HOST}:${DEPLOY_DIR} on port ${PORT}"
echo "Public URL: ${PUBLIC_URL} (proxied to ${PROXY_UPSTREAM})"
echo "Flags: RESET_DB=${RESET_DB} ENABLE_STORAGE=${ENABLE_STORAGE} SYNC_PROVIDER_ENV=${SYNC_PROVIDER_ENV}"
if [ "${ENABLE_STORAGE}" = "1" ]; then
  echo "Storage public URL: ${STORAGE_PUBLIC_URL} (browsers upload there)"
fi

# The archive only adds files, so the tree is cleared first: a file removed
# locally would otherwise linger on the server and end up in the build. The
# server .env, the previous build and the installed packages are kept.
ssh "${DEPLOY_HOST}" "mkdir -p '${DEPLOY_DIR}' && find '${DEPLOY_DIR}' -mindepth 1 -maxdepth 1 ! -name .env ! -name .next ! -name node_modules -exec rm -rf {} +"

COPYFILE_DISABLE=1 tar \
  --no-xattrs \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.next' \
  --exclude='node_modules' \
  --exclude='coverage' \
  --exclude='test-results' \
  --exclude='playwright-report' \
  --exclude='.DS_Store' \
  -czf - . | ssh "${DEPLOY_HOST}" "tar -xzf - -C '${DEPLOY_DIR}'"

# The provider lines travel through the ssh pipe into a temporary file that
# the remote step merges into .env and removes; nothing is echoed.
if [ "${SYNC_PROVIDER_ENV}" = "1" ]; then
  if [ ! -f .env ]; then
    echo "SYNC_PROVIDER_ENV=1 but there is no local .env" >&2
    exit 1
  fi
  grep -E '^(OIDC_|GITHUB_|GOOGLE_)[A-Z_]*=' .env \
    | ssh "${DEPLOY_HOST}" "umask 077; cat > '${DEPLOY_DIR}/.env.providers'"
  echo "Provider variables sent: $(grep -oE '^(OIDC_|GITHUB_|GOOGLE_)[A-Z_]*' .env | tr '\n' ' ')"
fi

ssh "${DEPLOY_HOST}" bash -s -- "${DEPLOY_DIR}" "${PORT}" "${PUBLIC_URL}" "${SERVICE_NAME}" "${RESET_DB}" "${ENABLE_STORAGE}" "${STORAGE_PUBLIC_URL}" <<'REMOTE'
set -euo pipefail

DEPLOY_DIR="$1"
PORT="$2"
PUBLIC_URL="$3"
SERVICE_NAME="$4"
RESET_DB="$5"
ENABLE_STORAGE="$6"
STORAGE_PUBLIC_URL="$7"
COMPOSE_SERVICE_NAME="${SERVICE_NAME}-compose"
CLEANUP_NAME="${SERVICE_NAME}-cleanup"

if ! command -v podman >/dev/null 2>&1 || ! command -v podman-compose >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  apt-get update
  apt-get install -y podman podman-compose unzip openssl
fi

if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  apt-get update
  . /etc/os-release
  if [ "${ID:-}" = "altlinux" ]; then
    apt-get install -y node
  else
    apt-get install -y ca-certificates curl gnupg
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
fi

export BUN_INSTALL="${HOME}/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi

PODMAN_COMPOSE="$(command -v podman-compose)"

cd "${DEPLOY_DIR}"

if [ ! -f .env ]; then
  AUTH_SECRET="$(openssl rand -base64 32)"
  umask 077
  cat > .env <<ENV
DATABASE_URL="postgresql://lively_forms:lively_forms@127.0.0.1:5432/lively_forms?schema=public"
AUTH_SECRET="${AUTH_SECRET}"
NEXTAUTH_URL="${PUBLIC_URL}"
ATPROTO_PUBLIC_URL="${PUBLIC_URL}"
ATPROTO_CLIENT_ID="${PUBLIC_URL}/api/atproto/client-metadata"
ATPROTO_REDIRECT_URI="${PUBLIC_URL}/api/auth/atproto/callback"
ATPROTO_CLIENT_NAME="Lively Forms"
ENV
  umask 022
fi

# Pins the public URLs, merges the provider lines sent from the local .env
# (if any) and appends the optional keys as commented placeholders so the
# server .env documents what can be set. Existing values are kept, except
# DATABASE_URL after RESET_DB=1: the new volume has the compose credentials.
python3 - "${PUBLIC_URL}" "${RESET_DB}" <<'PY'
from pathlib import Path
import re
import sys
public_url = sys.argv[1]
reset_db = sys.argv[2] == '1'
path = Path('.env')
lines = path.read_text().splitlines()
updates = {
    'NEXTAUTH_URL': f'"{public_url}"',
    'ATPROTO_PUBLIC_URL': f'"{public_url}"',
    'ATPROTO_CLIENT_ID': f'"{public_url}/api/atproto/client-metadata"',
    'ATPROTO_REDIRECT_URI': f'"{public_url}/api/auth/atproto/callback"',
}
if reset_db:
    updates['DATABASE_URL'] = '"postgresql://lively_forms:lively_forms@127.0.0.1:5432/lively_forms?schema=public"'
    print('RESET_DB=1: DATABASE_URL set to the compose credentials')
providers = Path('.env.providers')
if providers.exists():
    for line in providers.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            updates[key.strip()] = value
    providers.unlink()
    print('Merged provider variables into .env')

def key_of(line):
    match = re.match(r'^#?\s*([A-Z][A-Z0-9_]*)=', line)
    return match.group(1) if match else None

seen = set()
out = []
for line in lines:
    key = key_of(line)
    if key in updates:
        if key in seen:
            continue
        out.append(f'{key}={updates[key]}')
        seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f'{key}={value}')

template = f'''
# Optional, defaults to "atproto transition:generic"
# ATPROTO_SCOPE="atproto transition:generic"
# Optional OAuth sign-in providers; each is shown only when its variables are set
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_CLIENT_ID=""
# GITHUB_CLIENT_SECRET=""
# OIDC_ISSUER="https://auth.example.com/realms/master"
# OIDC_CLIENT_ID=""
# OIDC_CLIENT_SECRET=""
# OIDC_PROVIDER_NAME="SSO"
# OIDC_PROVIDER_ICON_URL=""
# OIDC_SCOPE="openid profile email"
# Optional public submission limits, defaults shown
# SUBMISSION_RATE_LIMIT=5
# SUBMISSION_GLOBAL_RATE_LIMIT=30
# SUBMISSION_RATE_WINDOW_SECONDS=600
# SUBMISSION_MIN_FILL_SECONDS=3
# Optional email notifications to form owners
# MAIL_FROM="Lively Forms <forms@example.com>"
# SMTP_URL="smtp://user:password@smtp.example.com:587"
# SMTP_HOST="smtp.example.com"
# SMTP_PORT=587
# SMTP_USER="user"
# SMTP_PASSWORD="password"
# SMTP_SECURE=false
# File uploads. S3_ENDPOINT is reached by the app on this host; S3_PUBLIC_ENDPOINT
# is reached by the respondent's browser and is required in production (the gate
# proxies it to Garage on this host, port 3900). Without it the FILE_UPLOAD block
# reports uploads as not available.
# S3_ENDPOINT="http://127.0.0.1:3900"
# S3_PUBLIC_ENDPOINT="https://storage.example.com"
# S3_REGION="garage"
# S3_BUCKET="lively-forms"
# S3_ACCESS_KEY_ID=""
# S3_SECRET_ACCESS_KEY=""
# UPLOAD_MAX_SIZE_MB=25
# UPLOAD_RATE_LIMIT=20
# UPLOAD_RATE_WINDOW_SECONDS=600
'''
present = {key_of(line) for line in out} - {None}
pending_comments = []
added = []
for line in template.strip('\n').splitlines():
    key = key_of(line)
    if key is None:
        pending_comments.append(line)
        continue
    if key in present:
        pending_comments = []
        continue
    added.extend(pending_comments)
    pending_comments = []
    added.append(line)
    present.add(key)
if added:
    out.append('')
    out.extend(added)
    print(f'Added {sum(1 for l in added if key_of(l))} placeholder keys to .env')
path.write_text('\n'.join(out).rstrip('\n') + '\n')
PY

set -a
. ./.env
set +a

bun install --frozen-lockfile

# The container from the old compose project is unknown to the new one and
# would hold port 5432 if it were ever started again.
if podman container exists the-forms-postgres; then
  podman rm -f the-forms-postgres
  echo "Removed stale container the-forms-postgres"
fi

if [ "${RESET_DB}" = "1" ]; then
  echo "RESET_DB=1: removing the compose containers and volumes, the database starts empty"
  "${PODMAN_COMPOSE}" down -v || true
  podman volume rm -f "$(basename "${DEPLOY_DIR}")_postgres-data" >/dev/null 2>&1 || true
  # The Garage volumes are gone too, so the key pair in .env is no longer valid.
  sed -i -E '/^#? ?S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)=/d' .env
fi

"${PODMAN_COMPOSE}" up -d

for _ in $(seq 1 30); do
  if podman exec lively-forms-postgres pg_isready -U lively_forms -d lively_forms >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
podman exec lively-forms-postgres pg_isready -U lively_forms -d lively_forms

if [ "${ENABLE_STORAGE}" = "1" ]; then
  # Writes S3_ENDPOINT, S3_REGION and S3_BUCKET into .env, the key pair only
  # when .env has none, and sets the bucket CORS rule for the public origin.
  GARAGE_ENV_FILE=.env \
  GARAGE_KEY_NAME=lively-forms \
  S3_ENDPOINT="http://127.0.0.1:3900" \
  S3_BUCKET="lively-forms" \
  UPLOAD_CORS_ORIGIN="${PUBLIC_URL}" \
    bash scripts/garage-init.sh
  sed -i -E '/^#? ?S3_PUBLIC_ENDPOINT=/d' .env
  printf 'S3_PUBLIC_ENDPOINT="%s"\n' "${STORAGE_PUBLIC_URL}" >> .env
  echo "Set S3_PUBLIC_ENDPOINT in .env"
  set -a
  . ./.env
  set +a
fi

bunx prisma migrate deploy
bun run build

# Containers do not come back after a reboot on their own; this oneshot unit
# brings the compose project up and the app unit requires it.
cat > "/etc/systemd/system/${COMPOSE_SERVICE_NAME}.service" <<UNIT
[Unit]
Description=Lively Forms containers (podman-compose)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${DEPLOY_DIR}
ExecStart=${PODMAN_COMPOSE} -f ${DEPLOY_DIR}/compose.yaml up -d
ExecStop=${PODMAN_COMPOSE} -f ${DEPLOY_DIR}/compose.yaml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
UNIT

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=Lively Forms
Requires=${COMPOSE_SERVICE_NAME}.service
After=network.target ${COMPOSE_SERVICE_NAME}.service

[Service]
Type=simple
WorkingDirectory=${DEPLOY_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
EnvironmentFile=${DEPLOY_DIR}/.env
ExecStart=${BUN_INSTALL}/bin/bun run start -- -H 0.0.0.0 -p ${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

# Pending uploads older than a day are removed every night at 04:00.
CLEANUP_CMD="cd ${DEPLOY_DIR} && set -a && . ./.env && set +a && ${BUN_INSTALL}/bin/bun run uploads:cleanup"
if systemctl is-active --quiet crond; then
  cat > "/etc/cron.d/${CLEANUP_NAME}" <<CRON
PATH=${BUN_INSTALL}/bin:/usr/local/bin:/usr/bin:/bin
0 4 * * * root ${CLEANUP_CMD} >> /var/log/${CLEANUP_NAME}.log 2>&1
CRON
  chmod 644 "/etc/cron.d/${CLEANUP_NAME}"
  rm -f "/etc/systemd/system/${CLEANUP_NAME}.timer" "/etc/systemd/system/${CLEANUP_NAME}.service"
  echo "Cleanup scheduled through /etc/cron.d/${CLEANUP_NAME}"
else
  cat > "/etc/systemd/system/${CLEANUP_NAME}.service" <<UNIT
[Unit]
Description=Lively Forms upload cleanup
After=${COMPOSE_SERVICE_NAME}.service

[Service]
Type=oneshot
WorkingDirectory=${DEPLOY_DIR}
Environment=PATH=${BUN_INSTALL}/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/bin/bash -c '${CLEANUP_CMD}'
UNIT
  cat > "/etc/systemd/system/${CLEANUP_NAME}.timer" <<UNIT
[Unit]
Description=Lively Forms upload cleanup, daily at 04:00

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  rm -f "/etc/cron.d/${CLEANUP_NAME}"
  echo "Cleanup scheduled through ${CLEANUP_NAME}.timer (crond is not active)"
fi

systemctl daemon-reload
systemctl enable --now "${COMPOSE_SERVICE_NAME}"
systemctl enable --now "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
if [ -f "/etc/systemd/system/${CLEANUP_NAME}.timer" ]; then
  systemctl enable --now "${CLEANUP_NAME}.timer"
fi

sleep 3
echo "--- ${COMPOSE_SERVICE_NAME}: $(systemctl is-active "${COMPOSE_SERVICE_NAME}") ($(systemctl is-enabled "${COMPOSE_SERVICE_NAME}"))"
echo "--- ${SERVICE_NAME}: $(systemctl is-active "${SERVICE_NAME}") ($(systemctl is-enabled "${SERVICE_NAME}"))"
systemctl --no-pager --full status "${SERVICE_NAME}" || true
echo "--- http://127.0.0.1:${PORT}/ -> $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/")"
REMOTE

echo "Deployed: ${PUBLIC_URL}"
