# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-08 – Auth: đăng ký, đăng nhập, refresh, đăng xuất
- Trạng thái: ✅ xong

## Đã làm
- Xây dựng `auth.validator.js`: Joi schema validate register (mật khẩu min 8 ký tự, có số và chữ), login, refresh.
- Xây dựng `auth.service.js`: register (mã `DG...`, hash bcrypt cost 10, role reader), login (chặn `locked`, cập nhật `lastLoginAt`), tạo access (15m) + refresh (7 ngày) băm SHA-256 lưu DB, refresh xoay vòng (rotate `jti`), logout (thu hồi token).
- Xây dựng `auth.controller.js`: quản lý cookie `refreshToken` httpOnly theo config, trả chuẩn `{ success, data }`.
- Xây dựng `auth.route.js`: gắn `authLimiter`, validate và mount vào `/api/v1/auth`.
- Export `optionalAuth` tại `middlewares/index.js`.
- Viết 20 test cases trong [tests/auth.test.js](file:///e:/githudRepo/library-management/library-backend/tests/auth.test.js) (20/20 passed, tổng 129/129 tests toàn bộ hệ thống passed).

## File chính đã tạo/sửa
- `app/validators/auth.validator.js`
- `app/services/auth.service.js`
- `app/controllers/auth.controller.js`
- `app/routes/auth.route.js`
- `app/routes/index.js`
- `app/middlewares/index.js`
- `tests/auth.test.js`
- `tasks/backend/BE-08.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100% không cảnh báo/lỗi.
- `npx jest tests/auth.test.js`: 20/20 tests passed.
- `npx jest [7 suites]`: 129/129 tests passed.

## Đang dở / bước tiếp theo
1. Tiến hành task BE-09 theo `tasks/backend/BE-09.md`: Hồ sơ /me, đổi mật khẩu, quên/đặt lại mật khẩu.

## Quyết định mới / điểm cần nhớ
- Refresh token được băm SHA-256 trước khi lưu vào MongoDB; cơ chế xoay vòng sinh thêm `jti: crypto.randomUUID()` đảm bảo không trùng lặp chuỗi.
- Endpoint `/auth/logout` dùng `optionalAuth` để cho phép người dùng đăng xuất sạch sẽ ngay cả khi access token vừa hết hạn.

## Task kế tiếp đề xuất
- BE-09 (Hồ sơ /me, đổi mật khẩu, quên/đặt lại mật khẩu)
