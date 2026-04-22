#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.local}"

if ! command -v node >/dev/null 2>&1; then
  echo "node not found. Please install Node.js (recommended: >= 20)."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Please install npm."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f ".env.example" ]]; then
    cp ".env.example" "$ENV_FILE"
    echo "Created $ENV_FILE from .env.example. Please edit it before starting."
  else
    echo "Missing $ENV_FILE and .env.example."
    exit 1
  fi
fi

echo "Installing dependencies (npm ci)..."
npm ci

echo "Generating Prisma client..."
npx prisma generate

if [[ -d "prisma/migrations" ]]; then
  echo "Applying Prisma migrations (deploy)..."
  npx prisma migrate deploy
else
  echo "No prisma/migrations found; skipping migrate deploy."
fi

echo "Building Next.js..."
npm run build

echo "Done. You can start with: ENV_FILE=$ENV_FILE ./scripts/server-start.sh"
