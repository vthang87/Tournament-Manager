# Môi trường demo

## Docker dev

Cần [Docker](https://docs.docker.com/get-docker/) và `make`.

```bash
cp .env.docker.example .env
make setup
make links
```

Lệnh hữu ích:

```bash
make logs
make down
make migrate
make seed
```

Nếu port mặc định đang bận:

```bash
cp docker-compose-dev.local.yaml.example docker-compose-dev.local.yaml
# Sửa APP_PORT và FORWARD_DB_PORT trong file local
make up
```

## Chạy trực tiếp

Cần Node.js 20+ và pnpm.

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

SQLite mặc định: `./data/tournament-manager.db`.

## Tài khoản và link demo

| Mục | Giá trị |
|---|---|
| Admin | `admin` / `admin123` |
| Đăng nhập | [http://localhost:3000/login](http://localhost:3000/login) |
| Trang công khai | [http://localhost:3000/t/hcmc-badminton-open-2026](http://localhost:3000/t/hcmc-badminton-open-2026) |
| Bảng live | [http://localhost:3000/t/hcmc-badminton-open-2026/live](http://localhost:3000/t/hcmc-badminton-open-2026/live) |
| Trọng tài sân C1 | [http://localhost:3000/r/hcmc-badminton-open-2026/c/C1](http://localhost:3000/r/hcmc-badminton-open-2026/c/C1) — PIN `1234` |

!!! danger "Khi đưa lên production"
    Đổi mật khẩu Admin ngay sau lần seed đầu và tắt `RUN_SEED_ON_START`.

## Tài liệu kỹ thuật

- [README dự án](https://github.com/vthang87/Tournament-Manager/blob/main/README.md)
- [Kiến trúc hệ thống](https://github.com/vthang87/Tournament-Manager/blob/main/docs/architecture.md)
