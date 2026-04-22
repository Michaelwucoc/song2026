#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it first (e.g. cp .env.example .env.local)."
  exit 1
fi

# Next.js will auto-load .env.local/.env, but we also export them here so that
# systemd/pm2 style starts behave consistently.
set -a
source "$ENV_FILE"
set +a

PORT="${PORT:-3000}"
HOSTNAME="${HOSTNAME:-0.0.0.0}"
NODE_ENV="${NODE_ENV:-production}"
export NODE_ENV PORT HOSTNAME

exec ./node_modules/.bin/next start -p "$PORT" -H "$HOSTNAME"
