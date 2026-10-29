# INDEX – Bảng task & trạng thái

Ký hiệu: ⬜ chưa làm · 🟦 đang làm · ✅ xong. `/next` chọn task ⬜ đầu tiên có mọi phụ thuộc ✅ (Backend trước, Frontend sau). `/done` cập nhật cột Trạng thái.

Mỗi task = 1 cuộc trò chuyện (~45–90 phút). Chi tiết: `tasks/backend/BE-xx.md`, `tasks/frontend/FE-xx.md`.

## TRACK BACKEND (BE-01 → BE-38): khởi tạo đến hoàn thành backend

| ID | Tiêu đề | Giai đoạn | Phụ thuộc | Trạng thái | Ghi chú |
|---|---|---|---|:-:|---|
| [BE-01](backend/BE-01.md) | Khởi tạo project backend | B0 Khởi tạo | – | ✅ | |
| [BE-02](backend/BE-02.md) | Cấu hình, kết nối DB, khung Express, /health | B0 Khởi tạo | BE-01 | ✅ | |
| [BE-03](backend/BE-03.md) | Utils nền: counters, sinh mã, phân trang | B0 Khởi tạo | BE-02 | ✅ | |
| [BE-04](backend/BE-04.md) | Models nhóm 1: users, danh mục, books | B1 Dữ liệu | BE-03 | ✅ | |
| [BE-05](backend/BE-05.md) | Models nhóm 2: giỏ, phiếu mượn, gia hạn, phạt, đặt trước, đánh giá, kệ | B1 Dữ liệu | BE-04 | ✅ | |
| [BE-06](backend/BE-06.md) | Models nhóm 3: thông báo, diễn đàn, settings, audit, refresh token | B1 Dữ liệu | BE-05 | ✅ | |
| [BE-07](backend/BE-07.md) | Middleware nền: auth, requireRole, validate, rateLimit | B2 Auth | BE-06 | ✅ | |
| [BE-08](backend/BE-08.md) | Auth: đăng ký, đăng nhập, refresh, đăng xuất | B2 Auth | BE-07 | ✅ | |
| [BE-09](backend/BE-09.md) | Hồ sơ /me, đổi mật khẩu, quên/đặt lại mật khẩu | B2 Auth | BE-08 | ✅ | |
| [BE-10](backend/BE-10.md) | Cloudinary & upload ảnh | B2 Auth | BE-09 | ✅ | |
| [BE-11](backend/BE-11.md) | Scripts: create-admin và khung seed | B2 Auth | BE-10 | ✅ | |
| [BE-12](backend/BE-12.md) | Danh mục: tác giả, thể loại, NXB (CRUD + công khai) | B3 Sách | BE-11 | ✅ | |
| [BE-13](backend/BE-13.md) | Sách: CRUD quản trị | B3 Sách | BE-12 | ✅ | |
| [BE-14](backend/BE-14.md) | Sách công khai: tìm kiếm, lọc, home, chi tiết | B3 Sách | BE-13 | ✅ | |
| [BE-15](backend/BE-15.md) | Seed dữ liệu danh mục & sách | B3 Sách | BE-14 | ✅ | |
| [BE-16](backend/BE-16.md) | Giỏ mượn | B4 Mượn trả | BE-14 | ✅ | |
| [BE-17](backend/BE-17.md) | notify.service (DB) và API thông báo của tôi | B4 Mượn trả | BE-06, BE-08 | ✅ | |
| [BE-18](backend/BE-18.md) | Socket.IO: xác thực, rooms, đẩy thông báo & số đếm | B4 Mượn trả | BE-17 | ✅ | |
| [BE-19](backend/BE-19.md) | Gửi yêu cầu mượn & phiếu của tôi | B4 Mượn trả | BE-16, BE-18 | ✅ | |
| [BE-20](backend/BE-20.md) | Duyệt / từ chối yêu cầu mượn (transaction) | B4 Mượn trả | BE-19 | ⬜ | |
| [BE-21](backend/BE-21.md) | Xác nhận giao sách | B4 Mượn trả | BE-20 | ⬜ | |
| [BE-22](backend/BE-22.md) | Trả sách & phạt tự động (transaction) | B4 Mượn trả | BE-21 | ⬜ | |
| [BE-23](backend/BE-23.md) | Quản lý phạt: xem, ghi nhận, thu, miễn | B4 Mượn trả | BE-22 | ⬜ | |
| [BE-24](backend/BE-24.md) | Gia hạn (1/2): độc giả gửi yêu cầu | B5 Gia hạn & tương tác | BE-22, BE-18 | ⬜ | |
| [BE-25](backend/BE-25.md) | Gia hạn (2/2): nhân viên duyệt / từ chối | B5 Gia hạn & tương tác | BE-24 | ⬜ | |
| [BE-26](backend/BE-26.md) | Đánh giá (chỉ người đã mượn) | B5 Gia hạn & tương tác | BE-22 | ⬜ | |
| [BE-27](backend/BE-27.md) | Kệ sách của tôi | B5 Gia hạn & tương tác | BE-14 | ⬜ | |
| [BE-28](backend/BE-28.md) | Quản lý người dùng (admin/staff) | B6 Quản trị | BE-23 | ⬜ | |
| [BE-29](backend/BE-29.md) | Settings & nhật ký hệ thống | B6 Quản trị | BE-28 | ⬜ | |
| [BE-30](backend/BE-30.md) | Quản lý thông báo (soạn, gửi nhóm) | B6 Quản trị | BE-18 | ⬜ | |
| [BE-31](backend/BE-31.md) | Dashboard & báo cáo Excel | B6 Quản trị | BE-23, BE-25 | ⬜ | |
| [BE-32](backend/BE-32.md) | Jobs định kỳ & endpoint chạy tay | B6 Quản trị | BE-25, BE-29 | ⬜ | |
| [BE-33](backend/BE-33.md) | Diễn đàn: chủ đề, trả lời, thích | B7 Diễn đàn & đặt trước | BE-08 | ⬜ | |
| [BE-34](backend/BE-34.md) | Diễn đàn: báo cáo & kiểm duyệt | B7 Diễn đàn & đặt trước | BE-33 | ⬜ | |
| [BE-35](backend/BE-35.md) | Đặt trước (hàng chờ FIFO) | B7 Diễn đàn & đặt trước | BE-22, BE-32 | ⬜ | |
| [BE-36](backend/BE-36.md) | Kiểm thử tự động cho nghiệp vụ trọng yếu | B8 Hoàn thiện | BE-35 | ⬜ | |
| [BE-37](backend/BE-37.md) | Swagger, README backend, rà soát bảo mật | B8 Hoàn thiện | BE-36 | ⬜ | |
| [BE-38](backend/BE-38.md) | Chuẩn bị & kiểm tra deploy backend | B8 Hoàn thiện | BE-37 | ⬜ | |

## TRACK FRONTEND (FE-01 → FE-38): khởi tạo đến hoàn thành frontend (làm sau khi BE xong)

| ID | Tiêu đề | Giai đoạn | Phụ thuộc | Trạng thái | Ghi chú |
|---|---|---|---|:-:|---|
| [FE-01](frontend/FE-01.md) | Khởi tạo project frontend | F0 Khởi tạo | – | ⬜ | |
| [FE-02](frontend/FE-02.md) | Styles, design tokens, App shell | F0 Khởi tạo | FE-01 | ⬜ | |
| [FE-03](frontend/FE-03.md) | api.service (axios), auth store khung, ui store | F0 Khởi tạo | FE-02 | ⬜ | |
| [FE-04](frontend/FE-04.md) | Component chung (1/2) | F0 Khởi tạo | FE-02 | ⬜ | |
| [FE-05](frontend/FE-05.md) | Layout công khai, navbar, footer, router khung | F1 Khách & Auth | FE-03, FE-04 | ⬜ | |
| [FE-06](frontend/FE-06.md) | Trang đăng nhập, đăng ký, quên/đặt lại mật khẩu | F1 Khách & Auth | FE-05 | ⬜ | |
| [FE-07](frontend/FE-07.md) | Service sách + component sách | F1 Khách & Auth | FE-04 | ⬜ | |
| [FE-08](frontend/FE-08.md) | Trang chủ | F1 Khách & Auth | FE-07, FE-05 | ⬜ | |
| [FE-09](frontend/FE-09.md) | Danh sách & tìm kiếm sách | F1 Khách & Auth | FE-07, FE-05 | ⬜ | |
| [FE-10](frontend/FE-10.md) | Chi tiết sách & trang tác giả | F1 Khách & Auth | FE-09 | ⬜ | |
| [FE-11](frontend/FE-11.md) | Giỏ mượn | F2 Độc giả | FE-10, FE-06 | ⬜ | |
| [FE-12](frontend/FE-12.md) | Lịch sử mượn của tôi | F2 Độc giả | FE-11 | ⬜ | |
| [FE-13](frontend/FE-13.md) | Yêu cầu gia hạn phía độc giả | F2 Độc giả | FE-12 | ⬜ | |
| [FE-14](frontend/FE-14.md) | Phạt của tôi | F2 Độc giả | FE-12 | ⬜ | |
| [FE-15](frontend/FE-15.md) | Hồ sơ cá nhân & ImageUploader | F2 Độc giả | FE-06 | ⬜ | |
| [FE-16](frontend/FE-16.md) | Thông báo realtime (Socket.IO) | F2 Độc giả | FE-06 | ⬜ | |
| [FE-17](frontend/FE-17.md) | Đánh giá sách | F2 Độc giả | FE-10, FE-06 | ⬜ | |
| [FE-18](frontend/FE-18.md) | Kệ sách của tôi | F2 Độc giả | FE-10 | ⬜ | |
| [FE-19](frontend/FE-19.md) | Layout quản trị, sidebar, badge realtime, DataTable | F3 Quản trị | FE-16 | ⬜ | |
| [FE-20](frontend/FE-20.md) | Dashboard quản trị | F3 Quản trị | FE-19 | ⬜ | |
| [FE-21](frontend/FE-21.md) | Duyệt yêu cầu mượn | F3 Quản trị | FE-19 | ⬜ | |
| [FE-22](frontend/FE-22.md) | Xác nhận giao sách | F3 Quản trị | FE-21 | ⬜ | |
| [FE-23](frontend/FE-23.md) | Xác nhận trả sách | F3 Quản trị | FE-22 | ⬜ | |
| [FE-24](frontend/FE-24.md) | Duyệt yêu cầu gia hạn | F3 Quản trị | FE-19 | ⬜ | |
| [FE-25](frontend/FE-25.md) | Tất cả phiếu mượn | F3 Quản trị | FE-19 | ⬜ | |
| [FE-26](frontend/FE-26.md) | Quản lý phạt | F3 Quản trị | FE-19 | ⬜ | |
| [FE-27](frontend/FE-27.md) | Quản lý sách | F3 Quản trị | FE-19, FE-15 | ⬜ | |
| [FE-28](frontend/FE-28.md) | Quản lý danh mục | F3 Quản trị | FE-19 | ⬜ | |
| [FE-29](frontend/FE-29.md) | Quản lý người dùng | F3 Quản trị | FE-19 | ⬜ | |
| [FE-30](frontend/FE-30.md) | Quản lý thông báo | F3 Quản trị | FE-19 | ⬜ | |
| [FE-31](frontend/FE-31.md) | Cài đặt & nhật ký hệ thống | F3 Quản trị | FE-19 | ⬜ | |
| [FE-32](frontend/FE-32.md) | Diễn đàn (1/2): trang chủ, chuyên mục | F4 Diễn đàn & đặt trước | FE-06 | ⬜ | |
| [FE-33](frontend/FE-33.md) | Diễn đàn (2/2): chi tiết, soạn bài, báo cáo | F4 Diễn đàn & đặt trước | FE-32 | ⬜ | |
| [FE-34](frontend/FE-34.md) | Kiểm duyệt diễn đàn (admin) | F4 Diễn đàn & đặt trước | FE-33, FE-19 | ⬜ | |
| [FE-35](frontend/FE-35.md) | Đặt trước sách | F4 Diễn đàn & đặt trước | FE-12 | ⬜ | |
| [FE-36](frontend/FE-36.md) | Trang giới thiệu, 403, rà soát giao diện | F5 Hoàn thiện | FE-35, FE-34 | ⬜ | |
| [FE-37](frontend/FE-37.md) | Kiểm thử chấp nhận theo vai trò & sửa lỗi | F5 Hoàn thiện | FE-36 | ⬜ | |
| [FE-38](frontend/FE-38.md) | Build & deploy frontend | F5 Hoàn thiện | FE-37 | ⬜ | |

## Cột mốc
- **M1** sau BE-11: nền tảng + auth chạy được
- **M2** sau BE-15: danh mục & sách có dữ liệu
- **M3** sau BE-23: luồng mượn → duyệt → giao → trả → phạt hoàn chỉnh
- **M4** sau BE-27: gia hạn, thông báo realtime, đánh giá, kệ sách
- **M5** sau BE-32: quản trị, báo cáo, job
- **M6** sau BE-35: diễn đàn + đặt trước (có thể cắt nếu thiếu thời gian)
- **M7** sau BE-38: backend hoàn tất & deploy
- **M8** sau FE-18: toàn bộ phía độc giả; **M9** sau FE-31: quản trị; **M10** sau FE-38: đồ án hoàn tất
