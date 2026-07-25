# Hướng dẫn sử dụng Tournament Manager

Tài liệu này dành cho **Ban tổ chức** (admin/operator), **trọng tài ghi tỉ số theo sân** (link + PIN, không cần tài khoản), và **khán giả** theo dõi công khai.

Giao diện hỗ trợ **Tiếng Việt** và **English** — đổi ngôn ngữ bằng nút trên header admin, trang đăng nhập, hoặc trang công khai giải.

---

## 1. Khái niệm nhanh

| Vai trò | Cách vào hệ thống | Việc chính |
|---|---|---|
| **Admin / Operator** | Đăng nhập `/login` → `/admin` | Tạo giải, sân, nội dung, bốc thăm, lịch, giám sát |
| **Trọng tài theo sân** | Mở link `/r/{slug}/c/{mã-sân}` + nhập PIN | Ghi tỉ số live / kết thúc trận trên đúng sân đó |
| **Khán giả** | `/t/{slug}` hoặc `/t/{slug}/live` | Xem lịch, kết quả, bảng xếp hạng (chỉ đọc) |

---

## 2. Chuẩn bị giải (Admin)

1. Đăng nhập admin.
2. Tạo hoặc mở **Giải đấu** → thêm **Nội dung** (đơn/đôi), luật điểm, vòng đấu (GROUP / KNOCKOUT).
3. Thêm **CLB / VĐV / Đăng ký** (nhập tay hoặc **Import Excel** — xem mục 2.2).
4. **Bốc thăm** → xác nhận draw.
5. Sinh trận vòng bảng / bracket khi draw đã xác nhận.
6. Gán **sân** và lịch nếu cần (**Schedule**).

### 2.1. Cấu hình sân + PIN trọng tài

Vào **Admin → Giải → Sân (Courts)**:

1. Thêm sân (tên + mã, ví dụ `C1`).
2. Đặt **PIN 4–6 chữ số** cho từng sân.
3. **Sao chép link** công khai dạng:

```text
{APP_URL}/r/{slug-giải}/c/{mã-sân}
```

Ví dụ sau seed demo:

- Link: `/r/hcmc-badminton-open-2026/c/C1`
- PIN demo: `1234`

**Lưu ý**

- Chưa đặt PIN → link sân trả 404 / không mở được ghi điểm.
- Xóa PIN → khóa ghi điểm qua link.
- Đổi PIN bất cứ lúc nào từ trang Courts.
- Có thể in **QR** link sân trực tiếp từ trang Courts.

### 2.2. Import / Export Excel (Operator+)

Vào **Nội dung → Import / Export**:

**Import đăng ký** (ADMIN hoặc OPERATOR):

1. Tải template mẫu.
2. Cột **đơn:** `Player Name`, `Club`, `Seed`
3. Cột **đôi:** `Player 1`, `Player 2`, `Club`, `Seed`
4. Upload `.xlsx` → xem preview → sửa lỗi chặn → **Xác nhận import** (một transaction, không ghi một phần).

**Export** (mọi role có quyền xem):

- `Participants`, `GroupDraw`, `Schedule`, `Results`, `Standings`

Giới hạn: file tối đa 2 MiB, 500 dòng import. Import hiện **không cập nhật** bản ghi đã có — chủ yếu dùng để tạo mới.

### 2.3. Org chart (sơ đồ giải)

**Admin → Giải → Org chart**:

- Tab **Cấu trúc giải:** giải → sân / nội dung → vòng → bảng.
- Tab **Cây trận đấu:** sơ đồ knockout (và tiến độ vòng bảng theo bảng).

Dùng để trình bày cấu trúc giải hoặc theo dõi nhánh loại trực tiếp trên một màn hình.

---

## 3. Trọng tài ghi tỉ số theo sân (PIN)

### 3.1. Mở khóa

1. Mở link sân trên điện thoại / tablet.
2. Nhập PIN → **Mở khóa**.
3. Hệ thống lưu cookie phiên (~12 giờ). Dùng **Khóa** khi trả máy / hết ca.

### 3.2. Khi có trận đang đấu trên sân

- Hiện cặp đấu + bảng nhập tỉ số (cùng kiểu nhập điểm admin).
- **Tự lưu tỉ số live** (mặc định bật) để bảng TV / public cập nhật.
- Khi đủ set thắng → nộp để **kết thúc trận**.
- **Đổi bên** đội A/B trước khi gọi vào sân (sau khi đã gọi vào sân thì không đổi — hủy gọi nếu cần).

### 3.3. Khi chưa có trận đang đấu

- Hiện trạng thái trống.
- Nếu có trận **đã gán sẵn** cho sân → nút **Bắt đầu trận**.
- Nếu có trận **chưa gán sân** trong hàng chờ → chọn cặp đấu từ danh sách → **Bắt đầu ngay** (sẽ gán vào sân hiện tại).

### 3.4. Gọi vào sân (warmup)

Trước khi bắt đầu trận, trọng tài hoặc admin có thể **Gọi vào sân**:

1. Chọn thời gian đếm ngược (1 / 3 / 5 phút).
2. Bảng live và trang công khai hiển thị đếm ngược **“Vào sân sau…”**.
3. Hết giờ → **“Vào sân!”**
4. **Hủy gọi** nếu cần hủy hoặc đổi cặp đấu.

### 3.5. Vắng mặt (no-show)

Khi một đội không có mặt, trọng tài PIN có thể xử lý **Vắng mặt**:

1. Chọn đội vắng.
2. Xác nhận → đội còn lại thắng walkover.

### 3.6. Giới hạn bảo mật

Trọng tài PIN **chỉ** được:

- Gọi vào sân / bắt đầu trận trên sân đó (đã gán hoặc chọn từ hàng chờ)
- Lưu live / kết thúc trận đang trên sân đó
- Đổi bên trước khi gọi vào sân
- Xử lý vắng mặt trên sân đó

**Không** được: hủy trận, sửa điểm sau khi hoàn thành, các thao tác special khác qua màn PIN.

Mọi thao tác ghi audit với metadata `{ via: "court_pin", courtId }` (không gắn user admin).

---

## 4. Điều hành trận từ Admin

**Nội dung → Trận đấu (Matches)**:

- Lọc theo bảng / vòng / trạng thái.
- Cột **Bắt đầu** / **Kết thúc** theo timezone giải.
- Cặp đấu: đội thắng màu xanh, đội thua màu xám (khi đã có người thắng).
- Vào chi tiết trận để:
  - Gán sân / **Gọi vào sân** / bắt đầu trận
  - Ghi điểm live
  - Sửa / hủy / walkover (theo quyền)

**Bảng live**

| Màn hình | URL | Ghi chú |
|---|---|---|
| Công khai (TV / khán giả) | `/t/{slug}/live` | Không cần đăng nhập |
| Admin (redirect public) | `/admin/tournaments/{id}/live` | Chuyển sang bản public theo slug |
| Bảng sân (ops) | `/admin/tournaments/{id}/courts/live` | Trạng thái từng sân, trận đang đấu / tiếp theo |

Bảng live tự làm mới định kỳ (~12 giây). Hiển thị đếm ngược gọi vào sân khi có.

---

## 5. Trang công khai cho khán giả

```text
{APP_URL}/t/{tournament-slug}
```

Gồm: lịch, kết quả, bảng, xếp hạng, bracket + QR. Không hiện PII nhạy cảm (số điện thoại, email, v.v.).

Bảng trực tiếp riêng:

```text
{APP_URL}/t/{tournament-slug}/live
```

---

## 6. Quy trình ngày thi đấu (gợi ý)

1. Admin kiểm tra sân active + PIN đã đặt; in/QR link từng sân.
2. Trọng tài mở link sân, nhập PIN.
3. **Gọi vào sân** khi VĐV sắp ra sân (tuỳ chọn).
4. Điều hành gán sân / bắt đầu trận (admin hoặc trọng tài nếu trận đã gán sẵn / chọn từ hàng chờ).
5. Trọng tài cập nhật điểm live → kết thúc trận.
6. Khán giả theo dõi `/t/{slug}` hoặc `/t/{slug}/live` (màn TV).
7. Hết ca: trọng tài bấm **Khóa**.

---

## 7. Vai trò & quyền (tóm tắt)

| Thao tác | ADMIN | OPERATOR | SCOREKEEPER | Court PIN |
|---|:---:|:---:|:---:|:---:|
| Setup giải / sân / PIN | ✓ | PIN: ✓ | | |
| Import Excel | ✓ | ✓ | | |
| Export Excel | ✓ | ✓ | ✓ | |
| Bốc thăm / sinh trận | ✓ | ✓ | | |
| Ghi điểm / bắt đầu trận | ✓ | ✓ | ✓ | ✓ (đúng sân) |
| Gọi vào sân | ✓ | ✓ | ✓ | ✓ (đúng sân) |
| Vắng mặt (no-show) | ✓ | ✓ | ✓ | ✓ (đúng sân) |
| Sửa điểm sau khi xong | ✓ | ✓ | | |
| Hủy / special khác | ✓ | ✓ | ✓* | |

\* Theo policy admin; **không** có trên màn Court PIN.

---

## 8. Môi trường demo / thử nghiệm

### 8.1. Docker dev (khuyến nghị)

Cần [Docker](https://docs.docker.com/get-docker/) và `make`.

```bash
cp .env.docker.example .env
make setup      # khởi động app + migrate + seed
make links      # in URL local
```

Lệnh hữu ích:

```bash
make logs       # xem log Next.js dev
make down       # dừng stack
make migrate    # chạy migration
make seed       # seed lại dữ liệu demo
```

Tuỳ chỉnh port (nếu 3000/5432 bận):

```bash
cp docker-compose-dev.local.yaml.example docker-compose-dev.local.yaml
# sửa APP_PORT, FORWARD_DB_PORT trong file local
make up
```

### 8.2. Chạy trực tiếp trên máy (pnpm)

Cần Node 20+, pnpm.

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

SQLite mặc định: `./data/tournament-manager.db`

### 8.3. Tài khoản & link demo (sau seed)

| Mục | Giá trị |
|---|---|
| Admin | `admin` / `admin123` |
| Đăng nhập | [http://localhost:3000/login](http://localhost:3000/login) |
| Trang công khai | [http://localhost:3000/t/hcmc-badminton-open-2026](http://localhost:3000/t/hcmc-badminton-open-2026) |
| Bảng live | [http://localhost:3000/t/hcmc-badminton-open-2026/live](http://localhost:3000/t/hcmc-badminton-open-2026/live) |
| Trọng tài sân C1 | [http://localhost:3000/r/hcmc-badminton-open-2026/c/C1](http://localhost:3000/r/hcmc-badminton-open-2026/c/C1) — PIN `1234` |

> **Production:** đổi mật khẩu admin ngay sau lần seed đầu; tắt `RUN_SEED_ON_START` trên server.

---

## 9. Xử lý sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Link sân 404 | Sân inactive, sai mã, hoặc chưa đặt PIN |
| PIN sai | Kiểm tra lại PIN trên trang Courts (có thể đã reset) |
| Không thấy trận để ghi | Chưa có `IN_PROGRESS` trên sân; bắt đầu trận hoặc chọn từ hàng chờ |
| Không bắt đầu được từ PIN | Sân đang bận trận khác, hoặc trận không hợp lệ |
| Không đổi được đội A/B | Đã gọi vào sân — hủy gọi trước |
| Live không cập nhật | Kiểm tra đã lưu live / auto-save; thử refresh `/t/{slug}/live` |
| QR / link sai domain | Kiểm tra biến `APP_URL` trên server khớp URL công khai |
| Muốn khóa máy trọng tài | Nút **Khóa** trên màn sân |
| Import Excel lỗi | Xem preview — sửa dòng lỗi; không vượt 500 dòng / 2 MiB |
| `make setup` lỗi DB | Chạy `make logs`; thử `make migrate` hoặc `make migrate-fresh` |

---

## 10. Tài liệu liên quan

- Setup kỹ thuật & production Docker: [`README.md`](../README.md)
- Kiến trúc hệ thống: [`architecture.md`](./architecture.md)
