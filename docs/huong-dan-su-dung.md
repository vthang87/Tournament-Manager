# Hướng dẫn sử dụng Tournament Manager

Hướng dẫn đã được chuyển thành website MkDocs Material và chia thành nhiều trang.

- [Mở nội dung hướng dẫn](./hdsd/index.md)
- [Quản lý tài khoản dành cho Super Admin](./hdsd/quan-ly-tai-khoan.md)
- [Môi trường và tài khoản demo](./hdsd/demo.md)
- [Bảng vai trò và quyền](./hdsd/vai-tro-quyen.md)
- [Xếp lịch tự động theo hai giai đoạn](./hdsd/xep-lich.md)
- [Xem trước và in lịch thi đấu](./hdsd/ngay-thi-dau.md#xem-truoc-va-in-lich-thi-dau)
- Khi chạy local: `mkdocs serve`
- Website GitHub Pages: <https://vthang87.github.io/Tournament-Manager/>

## In lịch thi đấu

Từ **Giải đấu → Nội dung → Lịch**, chọn **In lịch** để mở trang xem trước
riêng. Kiểm tra thời gian, giai đoạn, cặp đấu, sân và trạng thái; sau đó chọn
**In lịch** để in hoặc lưu PDF. Xem quy trình chi tiết tại
[Quy trình ngày thi đấu](./hdsd/ngay-thi-dau.md#xem-truoc-va-in-lich-thi-dau).

## Nội dung mới được cập nhật

- Phân loại theo môn thể thao và preset luật cho Badminton/Pickleball.
- Chủ sở hữu dữ liệu riêng và phân quyền cộng tác viên theo từng giải.
- Quản lý tài khoản Super Admin và hồ sơ cá nhân tại `/profile`.
- Xếp lịch vòng bảng/knockout, thời lượng trận, thời gian nghỉ và khóa lịch.
- Sân, PIN, QR có token truy cập, màn hình trọng tài và bảng live công khai.
- Bộ ảnh chụp thực tế cho toàn bộ quy trình vận hành chính.

## Tài khoản demo

Sau khi chạy `pnpm db:seed`, hệ thống tạo các tài khoản:

| Vai trò | Username | Mật khẩu |
|---|---|---|
| `SUPER_ADMIN` | `admin` | `admin123` |
| `ADMIN` | `demo-admin` | `demo1234` |
| `OPERATOR` | `demo-operator` | `demo1234` |
| `SCOREKEEPER` | `demo-scorekeeper` | `demo1234` |
| `VIEWER` | `demo-viewer` | `demo1234` |

Bốn tài khoản `demo-*` được chia sẻ vào giải mẫu
`HCMC Badminton Open 2026` với đúng vai trò tương ứng. Có thể thay đổi mật
khẩu chung của các tài khoản này bằng biến môi trường `SEED_DEMO_PASSWORD`.

!!! warning "Chỉ sử dụng cho môi trường demo"
    Đổi mật khẩu, vô hiệu hóa các tài khoản demo và tắt
    `RUN_SEED_ON_START` trước khi đưa hệ thống lên production.
