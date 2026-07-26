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

Ứng dụng sử dụng PostgreSQL theo biến `DATABASE_URL` trong file `.env`.

## Tài khoản và link demo

| Vai trò | Username | Mật khẩu |
|---|---|---|
| `SUPER_ADMIN` | `admin` | `admin123` |
| `ADMIN` | `demo-admin` | `demo1234` |
| `OPERATOR` | `demo-operator` | `demo1234` |
| `SCOREKEEPER` | `demo-scorekeeper` | `demo1234` |
| `VIEWER` | `demo-viewer` | `demo1234` |

Bốn tài khoản `demo-*` được chia sẻ vào giải
`HCMC Badminton Open 2026` với đúng vai trò tương ứng.

| Mục | Giá trị |
|---|---|
| Đăng nhập | [http://localhost:3000/login](http://localhost:3000/login) |
| Trang công khai | [http://localhost:3000/t/hcmc-badminton-open-2026](http://localhost:3000/t/hcmc-badminton-open-2026) |
| Bảng live | [http://localhost:3000/t/hcmc-badminton-open-2026/live](http://localhost:3000/t/hcmc-badminton-open-2026/live) |
| Trọng tài sân C1 | [http://localhost:3000/r/hcmc-badminton-open-2026/c/C1](http://localhost:3000/r/hcmc-badminton-open-2026/c/C1) — PIN `1234` |

!!! danger "Khi đưa lên production"
    Các tài khoản trên chỉ dành cho môi trường demo. Đổi mật khẩu, vô hiệu hóa
    tài khoản demo và tắt `RUN_SEED_ON_START` trước khi đưa lên production.

## Tài liệu kỹ thuật

- [README dự án](https://github.com/vthang87/Tournament-Manager/blob/main/README.md)
- [Kiến trúc hệ thống](https://github.com/vthang87/Tournament-Manager/blob/main/docs/architecture.md)
