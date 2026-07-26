# Điều hành trận từ Admin

Vào **Nội dung → Trận đấu (Matches)**.

## Danh sách trận

- Lọc theo bảng, vòng hoặc trạng thái.
- Theo dõi thời gian bắt đầu và kết thúc theo timezone giải.
- Đội thắng hiển thị màu xanh, đội thua màu xám khi trận hoàn tất.

<figure markdown="span">
  ![Danh sách trận đấu](assets/screenshots/20-danh-sach-tran.png)
  <figcaption>IMG-20 · Danh sách, trạng thái và bộ lọc trận đấu · Desktop.</figcaption>
</figure>

## Chi tiết trận

Tại trang chi tiết, người có quyền có thể:

- Gán sân, gọi vào sân hoặc bắt đầu trận.
- Ghi điểm live.
- Sửa kết quả, hủy trận hoặc xử lý walkover theo quyền.

<figure markdown="span">
  ![Chi tiết trận đấu](assets/screenshots/21-chi-tiet-tran.png)
  <figcaption>IMG-21 · Chi tiết trận, sân, lịch và các thao tác điều hành · Desktop.</figcaption>
</figure>

## Bảng sân dành cho vận hành

| Màn hình | URL | Ghi chú |
|---|---|---|
| Công khai | `/t/{slug}/live` | TV và khán giả, không cần đăng nhập |
| Admin | `/admin/tournaments/{id}/live` | Chuyển sang bảng public theo slug |
| Bảng sân | `/admin/tournaments/{id}/courts/live` | Trạng thái từng sân, trận hiện tại và tiếp theo |

Bảng live tự làm mới khoảng 12 giây và hiển thị đếm ngược gọi vào sân.

<figure markdown="span">
  ![Bảng trạng thái sân](assets/screenshots/22-bang-trang-thai-san.png)
  <figcaption>IMG-22 · Trận hiện tại và tiếp theo trên từng sân · Desktop widescreen.</figcaption>
</figure>
