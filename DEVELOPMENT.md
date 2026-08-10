# Phát triển Tournament Manager

Tài liệu này dành cho developer cài đặt môi trường, chạy database, tạo dữ liệu
demo, kiểm tra chất lượng và triển khai Tournament Manager.

## Công nghệ chính

- Next.js App Router, React và TypeScript
- Drizzle ORM với PostgreSQL
- Tailwind CSS
- Vitest và Playwright
- `next-intl` cho tiếng Việt và English

## Yêu cầu môi trường

- Node.js 20+ (`nvm use` đọc phiên bản từ `.nvmrc`)
- [pnpm](https://pnpm.io) 10+
- PostgreSQL 16 hoặc PostgreSQL tương thích

## Cài đặt local

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Kiểm tra và chỉnh `DATABASE_URL` cùng `TEST_DATABASE_URL` trong `.env` theo
PostgreSQL của môi trường local trước khi migrate. Sau khi khởi động, mở
[http://localhost:3000/login](http://localhost:3000/login).

Không cần chạy `pnpm db:generate` khi cài đặt repository từ các migration có
sẵn. Chỉ dùng lệnh này sau khi thay đổi Drizzle schema và cần tạo migration mới.

### Biến môi trường chính

| Biến | Mục đích |
|---|---|
| `DATABASE_URL` | Kết nối PostgreSQL của ứng dụng |
| `TEST_DATABASE_URL` | Database riêng cho test |
| `APP_URL` | Base URL dùng để tạo public link và QR |
| `SESSION_SECRET` | Khóa ký session; bắt buộc đổi ở production |
| `COURT_PIN_ENCRYPTION_KEY` | Khóa mã hóa PIN có thể xem lại; mặc định dùng `SESSION_SECRET` |
| `SEED_ADMIN_USERNAME` | Username của tài khoản seed `SUPER_ADMIN` |
| `SEED_ADMIN_PASSWORD` | Mật khẩu tài khoản seed `SUPER_ADMIN` |
| `SEED_ADMIN_DISPLAY_NAME` | Tên hiển thị của tài khoản seed |
| `SEED_DEMO_PASSWORD` | Mật khẩu chung của các tài khoản demo theo role |
| `RUN_SEED_ON_START` | Cho phép container seed khi khởi động |

Không commit `.env`, mật khẩu, token, khóa mã hóa hoặc chuỗi kết nối thật vào
repository.

## Dữ liệu demo

### Seed cơ bản

```bash
pnpm db:seed
```

Seed này idempotent và tạo:

- Giải `HCMC Badminton Open 2026`
- Nội dung đôi nam, 32 cặp, 3 bộ luật và 4 sân
- PIN trọng tài `1234` cho các sân demo
- Các tài khoản:

| Username | Mật khẩu mặc định | Role |
|---|---|---|
| `admin` | `admin123` | `SUPER_ADMIN` |
| `demo-admin` | `demo1234` | `ADMIN` |
| `demo-operator` | `demo1234` | `OPERATOR` |
| `demo-scorekeeper` | `demo1234` | `SCOREKEEPER` |
| `demo-viewer` | `demo1234` | `VIEWER` |

Các mật khẩu trên chỉ dành cho local/demo. Luôn thay đổi hoặc vô hiệu hóa tài
khoản demo trước khi đưa hệ thống lên production.

### Bộ scenario đầy đủ

```bash
pnpm db:seed:scenarios
```

Lệnh tạo 7 scenario độc lập:

| Môn | Trạng thái | Public URL |
|---|---|---|
| Badminton | Chờ bốc thăm | `/t/badminton-demo-draw-ready` |
| Badminton | Knockout live | `/t/badminton-demo-knockout-live` |
| Badminton | Hoàn tất | `/t/badminton-demo-completed` |
| Badminton 16 đội/4 bảng | Hoàn tất | `/t/badminton-16-teams-completed` |
| Pickleball | Chờ bốc thăm | `/t/pickleball-demo-draw-ready` |
| Pickleball | Knockout live | `/t/pickleball-demo-knockout-live` |
| Pickleball | Hoàn tất | `/t/pickleball-demo-completed` |

Các scenario 32 cặp có 8 bảng, 4 sân, vòng bảng và knockout bao gồm trận tranh
hạng ba. Dữ liệu bao phủ các trạng thái pending, scheduled, called-to-court,
in-progress và nhiều kiểu kết thúc đặc biệt.

### Tạo lại PIN demo

```bash
pnpm db:reset-demo-pins
```

Lệnh đặt PIN ngẫu nhiên 4 chữ số cho toàn bộ sân thuộc các giải seed. Tài khoản
có quyền có thể xem/copy PIN và tạo lại QR/link tại trang quản lý sân.

## URL thường dùng

| Màn hình | URL |
|---|---|
| Đăng nhập | `/login` |
| Dashboard | `/admin` |
| Hồ sơ cá nhân | `/profile` |
| Trang giải công khai | `/t/{tournament-slug}` |
| Public live board | `/t/{tournament-slug}/live` |
| TV board nội bộ | `/admin/tournaments/{tournamentId}/live` |
| Bảng sân trực tiếp | `/admin/tournaments/{tournamentId}/courts/live` |
| Trọng tài sân | `/r/{tournament-slug}/c/{court-code}` |

Các route `/admin/*` yêu cầu session hợp lệ. Trang `/t/*` là read-only công
khai; route trọng tài sân yêu cầu PIN của sân.

## Scripts

| Script | Mục đích |
|---|---|
| `pnpm dev` | Chạy Next.js development server |
| `pnpm build` | Tạo production build |
| `pnpm start` | Chạy production server từ build |
| `pnpm lint` | Chạy ESLint |
| `pnpm typecheck` | Chạy `tsc --noEmit` |
| `pnpm test` | Chạy Vitest một lần |
| `pnpm test:watch` | Chạy Vitest ở watch mode |
| `pnpm test:e2e` | Chạy Playwright smoke tests |
| `pnpm db:generate` | Sinh Drizzle migration sau khi đổi schema |
| `pnpm db:migrate` | Áp dụng migrations |
| `pnpm db:seed` | Seed dữ liệu local cơ bản |
| `pnpm db:seed:scenarios` | Seed 7 scenario Badminton/Pickleball |
| `pnpm db:reset-demo-pins` | Sinh lại PIN cho toàn bộ sân demo |
| `pnpm db:setup:pg` | Bootstrap PostgreSQL remote theo biến môi trường |
| `pnpm db:studio` | Mở Drizzle Studio |

## Kiểm tra chất lượng

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Sử dụng `TEST_DATABASE_URL` trỏ tới database test tách biệt. Playwright cần
browser tương ứng và development server theo cấu hình trong
`playwright.config.ts`.

## Docker

### Stack app + PostgreSQL

```bash
docker compose up -d --build
```

`compose.yaml` chạy PostgreSQL 16 và ứng dụng tại
[http://localhost:3000](http://localhost:3000). PostgreSQL được lưu trong named
volume `pg_data`; healthcheck ứng dụng nằm tại `/api/health`.

Stack mẫu bật `RUN_SEED_ON_START=true` để thuận tiện cho demo local. Khi triển
khai production, đặt biến này thành `false` sau lần seed đầu tiên và sử dụng
`SESSION_SECRET`, `COURT_PIN_ENCRYPTION_KEY` cùng mật khẩu PostgreSQL đủ mạnh.

### Docker development với HMR

```bash
cp .env.docker.example .env
make setup
make logs
```

`Makefile` dùng `docker-compose-dev.local.yaml`, tự tạo file local từ template
khi cần và chạy Next.js HMR trong container. Dùng `make help` để xem các lệnh
database, test, shell và build.

### Portainer và backup

- [Triển khai bằng Portainer](docs/portainer-deploy.md)
- PostgreSQL production phải được backup định kỳ bằng `pg_dump` hoặc cơ chế
  snapshot/backup của hạ tầng đang sử dụng.

## Ghi chú kiến trúc

- Business rules nằm trong application services và tournament engine; UI giữ
  vai trò trình bày và điều phối.
- Tournaments, clubs và players được giới hạn theo `ownerUserId`.
- Chủ giải có thể chia sẻ từng giải cho user hiện có với role riêng.
- `SUPER_ADMIN` quản lý tài khoản toàn hệ thống; `ADMIN`, `OPERATOR`,
  `SCOREKEEPER` và `VIEWER` được kiểm tra theo quyền và phạm vi giải.
- Public DTO không trả về phone, email, audit data hoặc thông tin tài khoản.
- Locale mặc định là `vi`; locale đang chọn được lưu trong cookie `tm_locale`.
- Public live board dùng SSE và tự fallback sang polling.

Xem thêm:

- [Kiến trúc hệ thống](docs/architecture.md)
- [Hướng dẫn sử dụng](docs/hdsd/index.md)
- [Triển khai Portainer](docs/portainer-deploy.md)
- [Chiến lược source-available](docs/open-source-strategy.md)
