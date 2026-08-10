# Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Link sân trả 404 | Kiểm tra sân active, mã sân và PIN đã được đặt |
| PIN sai | Kiểm tra PIN trên trang Courts; PIN có thể đã được đổi |
| Link sân không có token sau `#` | Tạo lại bằng nút **QR** hoặc **Sao chép link** sau khi đặt PIN |
| Không thấy trận để ghi | Bắt đầu trận đã gán hoặc chọn một trận từ hàng chờ |
| Không bắt đầu được từ PIN | Kiểm tra sân có đang bận và trận có hợp lệ không |
| Không đổi được đội A/B | Hủy gọi vào sân trước rồi thử lại |
| Live không cập nhật | Kiểm tra auto-save/lưu live và refresh `/t/{slug}/live` |
| QR hoặc link sai domain | Kiểm tra `APP_URL` trên server |
| Cần khóa máy trọng tài | Chọn **Khóa** trên màn sân |
| Import Excel lỗi | Sửa dòng lỗi trong preview; không vượt 500 dòng hoặc 2 MiB |
| Không thấy giải trên Dashboard | Kiểm tra chủ sở hữu hoặc vai trò cộng tác viên của tài khoản |
| Lịch loại trực tiếp có đội “Chưa xác định” | Hoàn tất vòng bảng/vòng trước rồi chạy gán lịch cho giai đoạn Knockout |
| Gán lại lịch không thay đổi | Kiểm tra lịch đã khóa; mở khóa trước khi tự động gán lại |
| Khoảng giờ không đúng | Khoảng giờ bằng thời lượng một trận cộng thời gian nghỉ |
| Bản xem trước in trống | Kiểm tra giải/nội dung có trận đã xếp lịch và mở lại **Lịch → In lịch** |
| `/admin/profile` hoặc `//profile` lỗi | Dùng đúng đường dẫn `/profile` |
| Route không tồn tại trả JSON | Mở từ giao diện web; trang 404 sẽ hiển thị với đường dẫn giao diện không hợp lệ |
| `make setup` lỗi database | Chạy `make logs`, sau đó thử `make migrate` hoặc `make migrate-fresh` |

## Thông tin cần ghi lại khi báo lỗi

- URL màn hình đang mở, không kèm token hoặc thông tin phiên.
- Mã giải, nội dung, sân hoặc trận liên quan.
- Thời điểm xảy ra lỗi và thao tác ngay trước đó.
- Thông báo lỗi hiển thị trên màn hình.
