# Triển khai Tournament Manager trên Portainer

Hai stack compose:

| File | Mô tả |
|---|---|
| `docker-compose.portainer.yaml` | App + PostgreSQL (khuyến nghị máy mới) |
| `docker-compose.portainer.external-db.yaml` | Chỉ app, DB ngoài (ví dụ `192.168.0.17`) |

Mẫu biến môi trường: [`.env.portainer.example`](../.env.portainer.example)

---

## 1. Stack Git (khuyến nghị)

1. Portainer → **Stacks** → **Add stack**
2. **Build method**: Git repository
3. Repository URL: repo GitHub của project
4. **Compose path**: `docker-compose.portainer.yaml` (hoặc `docker-compose.portainer.external-db.yaml`)
5. **Environment variables**: copy từ `.env.portainer.example`, điền giá trị thật
6. **Deploy the stack**

Container `app` khi start sẽ:

1. Chờ PostgreSQL sẵn sàng
2. Chạy `pnpm db:migrate`
3. Seed (nếu `RUN_SEED_ON_START=true`)
4. Chạy Next.js production (`node server.js`)

Health check: `GET /api/health`

---

## 2. Stack Web editor (không dùng Git)

1. Portainer → **Stacks** → **Add stack** → **Web editor**
2. Dán nội dung `docker-compose.portainer.yaml`
3. Thêm environment variables
4. Deploy

---

## 3. PostgreSQL ngoài (192.168.0.17)

Nếu DB đã có trên máy khác:

```bash
# Trên server Postgres (một lần)
node scripts/setup-pg-remote.mjs
```

Portainer env:

```env
DATABASE_URL=postgresql://tournament:tournament@192.168.0.17:5432/tournament_manager
APP_URL=https://your-domain.com
SESSION_SECRET=...
RUN_SEED_ON_START=true
```

Compose path: `docker-compose.portainer.external-db.yaml`

Đảm bảo container Portainer/host có route tới `192.168.0.17:5432` và `pg_hba.conf` cho phép kết nối từ subnet Docker.

---

## 4. Reverse proxy (HTTPS)

Đặt Nginx / Traefik / Cloudflare Tunnel phía trước:

```text
https://tournament.example.com  →  http://<host>:3000
```

`APP_URL` phải khớp URL công khai (QR code, link sân, trang public).

Ví dụ bind chỉ localhost nếu proxy trên cùng máy:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

(sửa trong compose hoặc override env `APP_PORT` tương ứng)

---

## 5. Lần deploy đầu

```env
RUN_SEED_ON_START=true
SEED_ADMIN_PASSWORD=your-secure-password
```

Sau khi đăng nhập admin thành công:

```env
RUN_SEED_ON_START=false
```

Redeploy stack.

---

## 6. Cập nhật phiên bản

**Git stack:** Portainer → Stack → **Pull and redeploy** (hoặc webhook).

**Build local rồi push image** (nếu không build trên agent):

```bash
docker build -t tournament-manager:latest .
# push to registry, set image in compose
```

---

## 7. Backup PostgreSQL

Stack có volume `tm_pg_data`:

```bash
docker run --rm \
  -v tm_pg_data:/var/lib/postgresql/data \
  -v "$PWD:/backup" \
  alpine tar czf /backup/tm-pg-$(date +%Y%m%d).tar.gz -C /var/lib/postgresql/data .
```

**Không xóa volume** `tm_pg_data` khi redeploy trừ khi cố ý reset DB.

---

## 8. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Container restart loop | Xem log `app`: thiếu `SESSION_SECRET` / `DATABASE_URL` |
| Migrate timeout | Kiểm tra `postgres` healthy; tăng `DB_WAIT_MAX_ATTEMPTS` |
| Health check fail | Đợi `start_period` 40s; xem log migrate |
| Link/QR sai domain | Sửa `APP_URL` và redeploy |
| Không kết nối DB ngoài | Ping `192.168.0.17:5432` từ container: `docker exec -it <app> sh` |

---

## Tài liệu liên quan

- Dev local (Makefile): `Makefile`, `docker-compose-dev.yaml`
- Bootstrap DB: `scripts/setup-pg-remote.mjs`
- HDSD vận hành: [`huong-dan-su-dung.md`](./huong-dan-su-dung.md)
