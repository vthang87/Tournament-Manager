# Quy trình ngày thi đấu

1. Admin kiểm tra các sân đang active và đã đặt PIN.
2. Kiểm tra, in hoặc lưu PDF lịch thi đấu đã gán.
3. In hoặc chia sẻ QR/link riêng cho từng sân.
4. Trọng tài mở link sân và nhập PIN.
5. Gọi VĐV vào sân khi sắp đến lượt.
6. Admin hoặc trọng tài gán sân và bắt đầu trận.
7. Trọng tài cập nhật điểm live và kết thúc trận.
8. Khán giả theo dõi trang giải hoặc bảng live.
9. Hết ca, trọng tài chọn **Khóa**.

!!! tip "Kiểm tra trước giờ thi đấu"
    Thử ít nhất một thiết bị trọng tài và một màn hình live trước khi đón VĐV. Xác nhận `APP_URL` dùng đúng domain công khai để QR không trỏ nhầm địa chỉ.

## Xem trước và in lịch thi đấu

1. Vào **Giải đấu → Nội dung → Lịch**.
2. Chọn **In lịch**. Hệ thống mở trang xem trước riêng tại
   `/admin/tournaments/{tournamentId}/events/{eventId}/schedule/print`.
3. Kiểm tra tên giải, nội dung thi đấu, múi giờ và các cột:
   **Thời gian**, **Giai đoạn**, **Trận đấu**, **Sân**, **Trạng thái**.
4. Chọn **In lịch** trên trang xem trước để mở hộp thoại in của trình duyệt.
5. Chọn máy in hoặc **Save as PDF / Lưu thành PDF**.
6. Chọn **Quay lại lịch** nếu cần chỉnh lịch rồi mở lại bản xem trước.

Trang xem trước chỉ liệt kê các trận **đã được gán thời gian**, sắp xếp theo
thời gian thi đấu. Sidebar, header quản trị và các nút thao tác sẽ tự ẩn trên
bản in.

!!! warning "Kiểm tra trước khi phát hành"
    Nếu thiếu trận hoặc thiếu sân trên bản xem trước, quay lại trang **Lịch** để
    hoàn tất gán lịch và lưu thay đổi trước khi in lại.

## Checklist nhanh

- [ ] Sân active và đúng mã
- [ ] PIN từng sân đã đặt
- [ ] QR/link đã kiểm tra
- [ ] Trận đã sinh và lịch hợp lệ
- [ ] Bản xem trước lịch in đủ thời gian, sân và cặp đấu
- [ ] Thiết bị trọng tài có kết nối mạng
- [ ] Bảng live hiển thị trên TV
- [ ] Trọng tài biết cách khóa thiết bị cuối ca
