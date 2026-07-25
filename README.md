# Tournament Manager

Internal tournament operations platform (badminton first). Stack: Next.js App Router, TypeScript, Drizzle ORM, SQLite, Tailwind CSS.

## Prerequisites

- Node.js 20+ (`nvm use` reads `.nvmrc`)
- [pnpm](https://pnpm.io) 10+

## Local setup

```bash
cp .env.example .env
pnpm install
pnpm db:generate   # first time / after schema changes
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000/login](http://localhost:3000/login). The seed creates:

- Admin user `admin` / `admin123` (Argon2-hashed; re-seed refreshes the hash)
- Tournament `HCMC Badminton Open 2026` (slug `hcmc-badminton-open-2026`)
- Men's Doubles event, 3 match-rule presets, 4 courts
- Court referee PIN `1234` on all demo courts (kiosk scoring)

`/admin/*` requires a signed `tm_session` cookie. Unauthenticated requests redirect to `/login`.

### Public URL pattern

Public read-only views (no auth, no PII):

```text
{APP_URL}/t/{tournament-slug}
```

Example after seed: [http://localhost:3000/t/hcmc-badminton-open-2026](http://localhost:3000/t/hcmc-badminton-open-2026)

Sections: schedule, results, groups, standings, bracket + QR code to the same URL.

Court referee scoring (PIN unlock, no admin account):

```text
{APP_URL}/r/{tournament-slug}/c/{court-code}
```

Example: [http://localhost:3000/r/hcmc-badminton-open-2026/c/C1](http://localhost:3000/r/hcmc-badminton-open-2026/c/C1) (PIN `1234` after seed). Configure PIN and copy links from Admin → Courts.

Ops boards (auth required):

- Dashboard: `/admin`
- TV live board: `/admin/tournaments/{id}/live` (polls ~12s)
- Court now/next: `/admin/tournaments/{id}/courts/live`

### Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Next.js development server |
| `pnpm build` / `pnpm start` | Production build & serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright smoke (skips if browsers/server missing) |
| `pnpm db:generate` | Generate Drizzle migrations from schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Idempotent local seed |
| `pnpm db:seed:scenarios` | Seed 6 idempotent badminton + pickleball demo scenarios |

SQLite file defaults to `./data/tournament-manager.db` (gitignored).

## Full demo scenarios

Run the dedicated scenario seed without changing the existing `pnpm db:seed`
snapshot:

```bash
pnpm db:seed:scenarios
```

The command creates six isolated demo tournaments. Each sport has a draw-ready
fixture, a knockout-live fixture, and a completed fixture:

| Sport | State | Public URL |
|---|---|---|
| Badminton | Draw ready | `/t/badminton-demo-draw-ready` |
| Badminton | Knockout live | `/t/badminton-demo-knockout-live` |
| Badminton | Completed | `/t/badminton-demo-completed` |
| Pickleball | Draw ready | `/t/pickleball-demo-draw-ready` |
| Pickleball | Knockout live | `/t/pickleball-demo-knockout-live` |
| Pickleball | Completed | `/t/pickleball-demo-completed` |

Every progressed fixture contains 32 men's doubles entries, 8 groups, 4
courts, 48 group matches, and a 16-match knockout bracket including the third
place match. Across each sport the data covers pending, scheduled,
called-to-court, in-progress, normal completion, walkover, no-show, retirement,
disqualification, and cancellation.

Pickleball uses one game to 15 for group/playoff matches and best-of-three to 11
for medal matches, win by two. The engine currently requires a finite maximum,
so the pickleball technical cap is set to 99.

Credentials remain `admin` / `admin123`; all demo court links use PIN `1234`.

## User guide website

The Vietnamese guide is built with Material for MkDocs. Source pages live in
[`docs/hdsd`](docs/hdsd/index.md).

```bash
python3 -m pip install -r requirements-docs.txt
mkdocs serve
mkdocs build --strict
```

Local preview: [http://127.0.0.1:8000](http://127.0.0.1:8000)

GitHub Pages: [https://vthang87.github.io/Tournament-Manager/](https://vthang87.github.io/Tournament-Manager/)

## Excel import / export

**Roles:** import = ADMIN or OPERATOR; export = any authenticated role with `view` (operator+ typically).

Per event:

1. Open `/admin/tournaments/{tournamentId}/events/{eventId}/import`
2. Download-shaped template columns:
   - **Singles:** `Player Name`, `Club`, `Seed`
   - **Doubles:** `Player 1`, `Player 2`, `Club`, `Seed`
3. Upload `.xlsx` → preview valid/invalid rows → fix blocking errors → **Confirm import** (single transaction; no partial write)
4. Export workbooks from `/admin/tournaments/{tournamentId}/events/{eventId}/export`:
   - `Participants`, `GroupDraw`, `Schedule`, `Results`, `Standings`

Limits: 2 MiB upload, 500 import rows. Formula-injection: leading `= + - @` are stripped on import and escaped (`'…`) on export.

## Docker production notes

```bash
docker compose up -d --build
```

- App: [http://localhost:3000](http://localhost:3000)
- Healthcheck: [http://localhost:3000/api/health](http://localhost:3000/api/health) (`curl` in image; Docker `HEALTHCHECK` every 30s)
- On start (`docker/entrypoint.sh`): **migrate → optional seed → `node server.js`**
- Persist SQLite via named volume `tm_data` → `/data/tournament-manager.db`
- Set a strong `SESSION_SECRET` and correct `APP_URL` for QR/public links
- For production, set `RUN_SEED_ON_START=false` after the first boot

### Backup / restore SQLite volume

```bash
# Backup (stop or briefly pause writes for a consistent copy)
docker compose stop app
docker run --rm -v tm_data:/data -v "$PWD:/backup" alpine \
  cp /data/tournament-manager.db /backup/tournament-manager-$(date +%Y%m%d).db
docker compose start app

# Restore
docker compose stop app
docker run --rm -v tm_data:/data -v "$PWD:/backup" alpine \
  cp /backup/tournament-manager-YYYYMMDD.db /data/tournament-manager.db
docker compose start app
```

Local non-Docker backup: copy `./data/tournament-manager.db` (and `-wal`/`-shm` if present) while the app is stopped, or use `sqlite3 .backup`.

## Operator guide — 32-team (8-group) flow

1. Create or open the tournament; add courts.
2. Create an event (singles/doubles) + match rules + stages: **Group** then **Knockout**.
3. Import or enter **32 entries**; mark event `DRAW_READY` when pipeline validates.
4. Generate and confirm the group draw (8 groups × 4).
5. Generate round-robin matches; schedule onto courts.
6. Score group matches; refresh standings; resolve qualification into KO.
7. Generate bracket; schedule KO; score through final.
8. Use `/admin` + live boards for ops; share `/t/{slug}` (+ QR) with audience.
9. Export Participants / Schedule / Results / Standings for records.

## Known V1 limitations

- Polling only for live/public refresh (no websockets/SSE).
- No spectator accounts; public view is fully anonymous read-only.
- Excel import does not update existing entries (create-oriented).
- Team events and advanced seeding UI are limited.
- Schedule conflict UX is service-backed; expect operators to resolve manually when warned.
- Single-node SQLite — not multi-writer / multi-region HA.
- Playwright E2E is a smoke suite; full 32-team automation is not bundled.

## Architecture notes

- Business logic stays in application services + tournament engine; UI stays thin.
- Public DTOs strip phone/email/audit/user fields.
- Admin routes are protected via server-side session checks in the admin layout.

See `docs/architecture.md` and `docs/cursor-implementation-plan.md`.

## Internationalization

Locales: **vi** (default) and **en**. Messages live in `messages/vi.json` and `messages/en.json`. The active locale is stored in the `tm_locale` cookie. Use the language switcher in the admin header, on the login page, and on the public tournament page (`/t/{slug}`).
