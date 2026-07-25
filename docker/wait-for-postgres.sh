#!/bin/sh
set -eu

max_attempts="${DB_WAIT_MAX_ATTEMPTS:-30}"
attempt=0

if [ -z "${DATABASE_URL:-}" ]; then
  exit 0
fi

echo "Waiting for PostgreSQL..."

while [ "$attempt" -lt "$max_attempts" ]; do
  if node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
"
  then
    echo "PostgreSQL is ready."
    exit 0
  fi

  attempt=$((attempt + 1))
  echo "PostgreSQL not ready yet (${attempt}/${max_attempts})..."
  sleep 2
done

echo "Timed out waiting for PostgreSQL." >&2
exit 1
