# Vai trò và quyền

| Thao tác | SUPER_ADMIN | ADMIN | OPERATOR | SCOREKEEPER | VIEWER | Court PIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Quản lý tài khoản | ✓ | | | | | |
| Xem và sửa hồ sơ cá nhân | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Xem giải được cấp quyền | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Setup giải / nội dung | ✓ | ✓ | Theo quyền giải | | | |
| Thêm, sửa sân / trạng thái | ✓ | ✓ | Theo quyền giải | | | |
| Xóa sân | ✓ | ✓ | | | | |
| Xem, đổi và sao chép PIN | ✓ | ✓ | ✓ | | | |
| Import Excel | ✓ | ✓ | ✓ | | | |
| Export Excel | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Bốc thăm / sinh trận | ✓ | ✓ | ✓ | | | |
| Xếp lại lịch khi chưa khóa | ✓ | ✓ | ✓ | | | |
| Xem trước / in lịch | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Ghi điểm / bắt đầu trận | ✓ | ✓ | ✓ | ✓ | | ✓ (đúng sân) |
| Gọi vào sân | ✓ | ✓ | ✓ | ✓ | | ✓ (đúng sân) |
| Vắng mặt | ✓ | ✓ | ✓ | ✓ | | ✓ (đúng sân) |
| Sửa điểm sau khi xong | ✓ | ✓ | ✓ | | | |
| Hủy / thao tác đặc biệt | ✓ | ✓ | ✓ | ✓* | | |

\* Theo policy Admin; không có trên màn Court PIN.

!!! note
    Quyền Court PIN gắn với sân, không gắn với tài khoản Admin. Link công
    khai của sân chỉ hoạt động khi sân có PIN; token truy cập nằm sau dấu
    `#` và không được gửi lên server. Luôn khóa thiết bị khi bàn giao hoặc
    kết thúc ca.

!!! info "Ẩn dữ liệu không được cấp quyền"
    Menu, bảng điều khiển và danh sách giải chỉ hiển thị dữ liệu mà tài khoản
    được phép truy cập. Việc ẩn nút trên giao diện luôn đi kèm kiểm tra quyền
    tại API.

Xem hướng dẫn chi tiết tại [Quản lý tài khoản](quan-ly-tai-khoan.md).
