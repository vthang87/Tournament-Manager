#!/bin/sh
set -eu

createdb -U "$POSTGRES_USER" "${POSTGRES_TEST_DB:-tournament_manager_test}" 2>/dev/null || true
