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

echo "Deploying to ${DEPLOY_HOST}:${DEPLOY_DIR} on port ${PORT}"
echo "Public URL: ${PUBLIC_URL} (proxied to ${PROXY_UPSTREAM})"

ssh "${DEPLOY_HOST}" "mkdir -p '${DEPLOY_DIR}'"

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

ssh "${DEPLOY_HOST}" bash -s -- "${DEPLOY_DIR}" "${PORT}" "${PUBLIC_URL}" "${SERVICE_NAME}" <<'REMOTE'
set -euo pipefail

DEPLOY_DIR="$1"
PORT="$2"
PUBLIC_URL="$3"
SERVICE_NAME="$4"

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

cd "${DEPLOY_DIR}"

if [ ! -f .env ]; then
  AUTH_SECRET="$(openssl rand -base64 32)"
  cat > .env <<ENV
DATABASE_URL="postgresql://lively_forms:lively_forms@127.0.0.1:5432/lively_forms?schema=public"
AUTH_SECRET="${AUTH_SECRET}"
NEXTAUTH_URL="${PUBLIC_URL}"
ATPROTO_PUBLIC_URL="${PUBLIC_URL}"
ATPROTO_CLIENT_ID="${PUBLIC_URL}/api/atproto/client-metadata"
ATPROTO_REDIRECT_URI="${PUBLIC_URL}/api/auth/atproto/callback"
ATPROTO_CLIENT_NAME="Lively Forms"
ENV
fi

python3 - "${PUBLIC_URL}" <<'PY'
from pathlib import Path
import sys
public_url = sys.argv[1]
path = Path('.env')
lines = path.read_text().splitlines()
updates = {
    'NEXTAUTH_URL': f'"{public_url}"',
    'ATPROTO_PUBLIC_URL': f'"{public_url}"',
    'ATPROTO_CLIENT_ID': f'"{public_url}/api/atproto/client-metadata"',
    'ATPROTO_REDIRECT_URI': f'"{public_url}/api/auth/atproto/callback"',
}
seen = set()
out = []
for line in lines:
    key = line.split('=', 1)[0] if '=' in line else None
    if key in updates:
        out.append(f'{key}={updates[key]}')
        seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f'{key}={value}')
path.write_text('\n'.join(out) + '\n')
PY

set -a
. ./.env
set +a

bun install --frozen-lockfile
podman-compose up -d
bunx prisma migrate deploy
bun run build

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=Lively Forms
After=network.target

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

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl --no-pager --full status "${SERVICE_NAME}"
REMOTE

echo "Deployed: ${PUBLIC_URL}"
