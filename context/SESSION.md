# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-09 – Hồ sơ /me, đổi mật khẩu, quên/đặt lại mật khẩu
- Trạng thái: ✅ xong

## Đã làm
- Bổ sung `passwordResetToken`, `passwordResetExpires` vào [user.model.js](file:///e:/githudRepo/library-management/library-backend/app/models/user.model.js).
- Xây dựng [mailer.util.js](file:///e:/githudRepo/library-management/library-backend/app/utils/mailer.util.js): gửi email qua SMTP Nodemailer, tự fallback in liên kết reset ra console khi dev hoặc chưa cấu hình SMTP thực tế.
- Xây dựng [user.service.js](file:///e:/githudRepo/library-management/library-backend/app/services/user.service.js) & [user.validator.js](file:///e:/githudRepo/library-management/library-backend/app/validators/user.validator.js): xem hồ sơ, cập nhật hồ sơ (chặn sửa role, status, code, email), đổi mật khẩu (kiểm tra mật khẩu cũ).
- Mở rộng [auth.service.js](file:///e:/githudRepo/library-management/library-backend/app/services/auth.service.js): quên mật khẩu (luôn trả 200 an toàn, token SHA-256 TTL 30m), đặt lại mật khẩu (dùng 1 lần, thu hồi mọi refresh token).
- Xây dựng [user.controller.js](file:///e:/githudRepo/library-management/library-backend/app/controllers/user.controller.js), cập nhật [auth.controller.js](file:///e:/githudRepo/library-management/library-backend/app/controllers/auth.controller.js), [me.route.js](file:///e:/githudRepo/library-management/library-backend/app/routes/me.route.js) và mount `/me` vào router v1.
- Viết 19 bài kiểm thử trong [tests/me-and-password.test.js](file:///e:/githudRepo/library-management/library-backend/tests/me-and-password.test.js) (toàn bộ 148/148 tests backend passed).

## File chính đã tạo/sửa
- `app/models/user.model.js`
- `app/utils/mailer.util.js`
- `app/services/{user.service.js,auth.service.js}`
- `app/validators/{user.validator.js,auth.validator.js}`
- `app/controllers/{user.controller.js,auth.controller.js}`
- `app/routes/{me.route.js,auth.route.js,index.js}`
- `tests/me-and-password.test.js`
- `tasks/backend/BE-09.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100% không cảnh báo/lỗi.
- `npx jest [8 suites]`: 148/148 tests passed.

## Đang dở / bước tiếp theo
1. Tiến hành task BE-10 theo `tasks/backend/BE-10.md`: Cloudinary & upload ảnh (`POST /me/avatar`, `upload.middleware.js`).

## Quyết định mới / điểm cần nhớ
- Token reset mật khẩu được băm SHA-256 lưu trong DB và chỉ có hiệu lực 30 phút. Sau khi reset thành công, mọi refresh token đang lưu hành của tài khoản đều bị thu hồi lập tức.
- `mailer.util` tự động phát hiện placeholder cấu hình email mẫu để giả lập in console, không gây treo socket khi dev/test.

## Task kế tiếp đề xuất
- BE-10 (Cloudinary & upload ảnh)
