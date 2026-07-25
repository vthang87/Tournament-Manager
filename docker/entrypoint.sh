#!/bin/sh
set -eu

export DATABASE_URL="${DATABASE_URL:-postgresql://tournament:tournament@postgres:5432/tournament_manager}"

echo "Running database migrations..."
pnpm db:migrate

if [ "${RUN_SEED_ON_START:-true}" = "true" ]; then
  echo "Running idempotent seed..."
  pnpm db:seed
fi

echo "Starting Tournament Manager..."
exec node server.js
