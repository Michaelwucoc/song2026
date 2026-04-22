#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it first (e.g. cp .env.example .env.local)."
  exit 1
fi

echo "Updating dependencies (npm ci)..."
npm ci

echo "Generating Prisma client..."
npx prisma generate

if [[ -d "prisma/migrations" ]]; then
  echo "Applying Prisma migrations (deploy)..."
  npx prisma migrate deploy
fi

echo "Building Next.js..."
npm run build

echo "Update done."
