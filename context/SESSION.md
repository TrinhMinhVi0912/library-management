# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-10 – Cloudinary & upload ảnh
- Trạng thái: ✅ xong

## Đã làm
- Xây dựng [cloudinary.util.js](file:///e:/githudRepo/library-management/library-backend/app/utils/cloudinary.util.js): cấu hình Cloudinary SDK, tải buffer qua `upload_stream` trả `{ url, publicId }`, xóa ảnh qua `destroy(publicId)` kèm cơ chế fallback an toàn khi dev/test dùng placeholder.
- Xây dựng [upload.middleware.js](file:///e:/githudRepo/library-management/library-backend/app/middlewares/upload.middleware.js): multer `memoryStorage`, kích thước tối đa 2MB, lọc ảnh JPG/PNG/WEBP, xử lý lỗi MulterError thân thiện; cung cấp `uploadSingle` và `uploadAvatar` (nhận linh hoạt trường `avatar` hoặc `file`).
- Xây dựng [upload.controller.js](file:///e:/githudRepo/library-management/library-backend/app/controllers/upload.controller.js) & [upload.route.js](file:///e:/githudRepo/library-management/library-backend/app/routes/upload.route.js): endpoint `POST /api/v1/admin/uploads` (staff|admin, field `file`, query `folder`).
- Mở rộng [user.service.js](file:///e:/githudRepo/library-management/library-backend/app/services/user.service.js) & [user.controller.js](file:///e:/githudRepo/library-management/library-backend/app/controllers/user.controller.js): endpoint `POST /api/v1/me/avatar`, tự động xóa ảnh cũ trên Cloudinary trước khi lưu avatar mới.
- Viết 16 bài kiểm thử trong [tests/upload.test.js](file:///e:/githudRepo/library-management/library-backend/tests/upload.test.js) (toàn bộ 16/16 tests pass).

## File chính đã tạo/sửa
- `app/utils/cloudinary.util.js`
- `app/middlewares/upload.middleware.js`
- `app/middlewares/errorHandler.js`
- `app/middlewares/index.js`
- `app/controllers/upload.controller.js`
- `app/controllers/user.controller.js`
- `app/services/user.service.js`
- `app/routes/upload.route.js`
- `app/routes/me.route.js`
- `app/routes/index.js`
- `tests/upload.test.js`
- `tasks/backend/BE-10.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100% không cảnh báo/lỗi.
- `npx jest tests/upload.test.js`: 16/16 tests passed.

## Đang dở / bước tiếp theo
1. Tiến hành task BE-11 theo `tasks/backend/BE-11.md`: Scripts `create-admin` và khung `seed.js`.

## Quyết định mới / điểm cần nhớ
- `cloudinary.util` tự động nhận biết placeholder `your_cloudinary_*` để fallback giả lập an toàn, không cố gọi ra internet gây lỗi DNS khi chạy dev/test local.
- `POST /me/avatar` chấp nhận linh hoạt multipart/form-data gửi với trường `avatar` hoặc `file`.

## Task kế tiếp đề xuất
- BE-11 (Scripts: create-admin và khung seed)
