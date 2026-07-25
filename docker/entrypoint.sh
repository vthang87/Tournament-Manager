#!/bin/sh
set -eu

export DATABASE_URL="${DATABASE_URL:-/data/tournament-manager.db}"

echo "Running database migrations..."
pnpm db:migrate

if [ "${RUN_SEED_ON_START:-true}" = "true" ]; then
  echo "Running idempotent seed..."
  pnpm db:seed
fi

echo "Starting Tournament Manager..."
exec node server.js
