#!/bin/sh
# Sync container node_modules after pnpm-lock.yaml changes on the host.
# Hooked from package.json postinstall; also: make pnpm-sync

set -e

if [ -f /.dockerenv ]; then
  exit 0
fi

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose-dev.local.yaml}"

if [ ! -f "$ROOT/$COMPOSE_FILE" ]; then
  COMPOSE_FILE=docker-compose-dev.yaml
fi

if [ ! -f "$ROOT/pnpm-lock.yaml" ]; then
  exit 0
fi

DC="docker compose -f $ROOT/$COMPOSE_FILE"
SERVICE="${DOCKER_SERVICE:-tm_app}"

if ! $DC ps -q "$SERVICE" 2>/dev/null | grep -q .; then
  echo ""
  echo "→ Đã cập nhật pnpm-lock.yaml. Container chưa chạy."
  echo "  Sau khi make up: chạy make pnpm-sync"
  echo ""
  exit 0
fi

LOCK_MD5=$(md5sum "$ROOT/pnpm-lock.yaml" | cut -d' ' -f1)

echo ""
echo "→ Đồng bộ node_modules vào Docker (pnpm install --frozen-lockfile)..."
$DC exec -T "$SERVICE" sh -c "
    set -e
    rm -rf node_modules/*
    pnpm install --frozen-lockfile
    echo '$LOCK_MD5' > node_modules/.docker-pnpm-lock.md5
    touch node_modules/.docker-installed
"

if $DC restart "$SERVICE" >/dev/null 2>&1; then
  echo "→ Đã restart tm_app (Next.js dev)."
else
  echo "→ Không restart được tm_app — thử: make dev-restart"
fi

echo ""
