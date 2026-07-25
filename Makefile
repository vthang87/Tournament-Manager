# Docker dev — Next.js HMR trong container (không pnpm build).
# Test chạy trên host: make test  (DB tournament_manager_test @ 192.168.0.17)
#
# Quick start:
#   cp .env.docker.example .env
#   make setup
#   make logs

COMPOSE_FILE ?= docker-compose-dev.local.yaml
DC := docker compose -f $(COMPOSE_FILE)
SERVICE := tm_app

.PHONY: help ensure-local-compose sync-compose up down image restart dev-restart links logs ps bash shell \
	pnpm pnpm-install pnpm-sync pnpm-add db-generate migrate migrate-fresh seed db-studio \
	setup exec lint typecheck test test-docker ci-check build-docker

ensure-local-compose:
	@test -f $(COMPOSE_FILE) || cp docker-compose-dev.yaml $(COMPOSE_FILE)

sync-compose:
	cp docker-compose-dev.yaml $(COMPOSE_FILE)
	@echo "Synced $(COMPOSE_FILE) from docker-compose-dev.yaml"

help:
	@echo "Docker dev (Next.js HMR — không build trong container):"
	@echo ""
	@echo "  Stack"
	@echo "    up              Start containers (no image rebuild) + print links"
	@echo "    links           Print local service URLs / ports"
	@echo "    image           Rebuild Docker image"
	@echo "    down, restart, dev-restart, logs, ps"
	@echo ""
	@echo "  Shell"
	@echo "    bash, shell, exec cmd='...'"
	@echo ""
	@echo "  Node / DB"
	@echo "    pnpm-install      pnpm install trong container (= pnpm-sync)"
	@echo "    pnpm-sync         Sau khi thêm/sửa package trên host → cài lại Docker + restart dev"
	@echo "    pnpm-add PKG=...  pnpm add trên host + pnpm-sync Docker"
	@echo "    db-generate, migrate, migrate-fresh, seed, db-studio"
	@echo ""
	@echo "  Test (host — không trong container dev)"
	@echo "    test              vitest trên máy host"
	@echo "    test-docker       Chỉ khi cần chạy test trong container"
	@echo ""
	@echo "  CI / production"
	@echo "    ci-check          lint + typecheck + test trong container"
	@echo "    build-docker      pnpm build trong container (deploy smoke)"

up down image restart dev-restart links logs ps bash shell pnpm pnpm-install pnpm-sync pnpm-add \
	db-generate migrate migrate-fresh seed db-studio setup exec lint typecheck test test-docker \
	ci-check build-docker sync-compose: ensure-local-compose

up:
	$(DC) up -d
	@$(MAKE) --no-print-directory links

image:
	$(DC) build

down:
	$(DC) down

restart:
	$(DC) restart $(SERVICE)

dev-restart:
	$(DC) restart $(SERVICE)
	@$(MAKE) --no-print-directory links

links:
	@APP_PORT=$${APP_PORT:-3000}; \
	echo ""; \
	echo "Local links:"; \
	echo "  App:         http://localhost:$${APP_PORT}"; \
	echo "  PostgreSQL:  \$${DATABASE_URL:-192.168.0.17:5432/tournament_manager}"; \
	echo "  Health:      http://localhost:$${APP_PORT}/api/health"; \
	echo "  Logs:        make logs"; \
	echo ""

logs:
	$(DC) logs -f

ps:
	$(DC) ps

bash shell:
	$(DC) exec $(SERVICE) bash

exec:
	$(DC) exec $(SERVICE) $(cmd)

pnpm:
	$(DC) exec $(SERVICE) pnpm $(or $(ARGS),install)

pnpm-install: pnpm-sync

pnpm-sync:
	@sh scripts/pnpm-docker-sync.sh

pnpm-add:
	@test -n "$(PKG)" || (echo "Usage: make pnpm-add PKG=<package> [PKG2=...]" && exit 1)
	pnpm add $(PKG) $(PKG2) $(PKG3)
	@$(MAKE) pnpm-sync

db-generate:
	$(DC) exec $(SERVICE) pnpm db:generate

migrate:
	$(DC) exec $(SERVICE) pnpm db:migrate

migrate-fresh:
	$(DC) down -v
	$(DC) up -d
	@sleep 2
	@$(MAKE) migrate seed

seed:
	$(DC) exec $(SERVICE) pnpm db:seed

db-studio:
	$(DC) exec $(SERVICE) pnpm db:studio

setup: up pnpm-install migrate seed
	@echo ""
	@echo "Docker dev đã sẵn sàng (Next.js HMR, không build)."
	@echo "  Test: make test  (chạy trên host, không trong container)"
	@echo "  Links: make links"

lint:
	$(DC) exec $(SERVICE) pnpm lint

typecheck:
	$(DC) exec $(SERVICE) pnpm typecheck

test:
	pnpm test $(or $(ARGS),)

test-docker:
	$(DC) exec $(SERVICE) pnpm test $(or $(ARGS),)

build-docker:
	$(DC) exec $(SERVICE) pnpm build

ci-check:
	$(DC) exec $(SERVICE) sh -c 'pnpm lint && pnpm typecheck && pnpm test'
