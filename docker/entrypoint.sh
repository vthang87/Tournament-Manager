#!/bin/sh
set -eu

export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required." >&2
  exit 1
fi

if [ -z "${SESSION_SECRET:-}" ]; then
  echo "ERROR: SESSION_SECRET is required (min 32 characters)." >&2
  exit 1
fi

/sh/wait-for-postgres.sh

echo "Running database migrations..."
pnpm db:migrate

if [ "${RUN_SEED_ON_START:-false}" = "true" ]; then
  echo "Running idempotent seed..."
  pnpm db:seed
fi

echo "Starting Tournament Manager on ${HOSTNAME}:${PORT}..."
exec node server.js
