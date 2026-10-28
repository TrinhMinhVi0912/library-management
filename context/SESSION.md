# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-07 – Middleware nền: auth, requireRole, validate, rateLimit
- Trạng thái: ✅ xong

## Đã làm
- Xây dựng `auth.middleware.js`: Bearer token verify JWT, tra cứu User, chặn 401 (thiếu/sai/hết hạn/locked), gắn `req.user`. Kèm `optionalAuth`.
- Xây dựng `requireRole.middleware.js`: chặn 401 nếu chưa đăng nhập, 403 nếu `req.user.role` không thuộc danh sách cho phép (nhận args hoặc mảng).
- Xây dựng `validate.middleware.js`: validate Joi schema đơn hoặc multi-source (`body`, `query`, `params`), trả 422 với danh sách `errors: [{ field, message }]`.
- Xây dựng `rateLimit.middleware.js`: `generalLimiter` (1000 req/15m), `authLimiter` (20 req/15m), `forumPostLimiter` (5 req/1m) với format JSON lỗi chuẩn 429.
- Thêm `ApiError.unprocessableEntity` (422), barrel export `app/middlewares/index.js`, tích hợp `generalLimiter` vào `app.js`.
- Viết bộ unit tests [tests/middlewares.test.js](file:///e:/githudRepo/library-management/library-backend/tests/middlewares.test.js) (21/21 tests passed).

## File chính đã tạo/sửa
- `app/middlewares/{auth,requireRole,validate,rateLimit}.middleware.js`
- `app/middlewares/{errorHandler.js,index.js}`
- `app/api-error.js`
- `app.js`
- `tests/middlewares.test.js`
- `tasks/backend/BE-07.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100% không cảnh báo/lỗi.
- `npx jest tests/middlewares.test.js`: 21/21 tests passed.

## Đang dở / bước tiếp theo
1. Tiến hành task BE-08 theo `tasks/backend/BE-08.md`: Auth: đăng ký, đăng nhập, refresh, đăng xuất.

## Quyết định mới / điểm cần nhớ
- `validate` hỗ trợ cả schema đơn (`validate(schema, 'query')`) lẫn object multi-source (`validate({ body, query })`).
- `auth.optionalAuth` cho phép các endpoint xem công khai nhưng có thể cá nhân hóa nếu người dùng đã đăng nhập.

## Task kế tiếp đề xuất
- BE-08 (Auth: đăng ký, đăng nhập, refresh, đăng xuất)
