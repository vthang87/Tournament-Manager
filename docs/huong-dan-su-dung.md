# Hướng dẫn sử dụng Tournament Manager

Hướng dẫn đã được chuyển thành website MkDocs Material và chia thành nhiều trang.

- [Mở nội dung hướng dẫn](./hdsd/index.md)
- [Quản lý tài khoản dành cho Super Admin](./hdsd/quan-ly-tai-khoan.md)
- [Môi trường và tài khoản demo](./hdsd/demo.md)
- [Bảng vai trò và quyền](./hdsd/vai-tro-quyen.md)
- Khi chạy local: `mkdocs serve`
- Website GitHub Pages: <https://vthang87.github.io/Tournament-Manager/>

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
