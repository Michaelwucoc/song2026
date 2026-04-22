#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  cat > ".env" <<'EOF'
DATABASE_URL="file:./dev.db"

ADMIN_PASSWORD="admin123"
ADMIN_SESSION_TTL_SECONDS=28800

USER_COOLDOWN_SECONDS=300
# REDIS_URL=redis://localhost:6379
EOF
  echo "Created .env (SQLite + default admin password)."
fi

if [[ ! -d "node_modules" ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Ensuring database schema..."
npx prisma generate >/dev/null
npx prisma migrate dev --name init --skip-seed >/dev/null

echo "Starting dev server..."
npm run dev

