#!/usr/bin/env bash
# Runs compose.yaml with podman-compose when available, otherwise docker compose.
set -euo pipefail

if command -v podman-compose >/dev/null 2>&1; then
  exec podman-compose "$@"
fi

exec docker compose "$@"
