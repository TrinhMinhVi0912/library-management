# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-16 – Giỏ mượn
- Trạng thái: ✅ xong

## Đã làm
- Tạo [cart.service.js](file:///e:/githudRepo/library-management/library-backend/app/services/cart.service.js): `getCart(userId)`, `addItem(userId, bookId)`, `removeItem(userId, bookId)`.
- Tạo [cart.controller.js](file:///e:/githudRepo/library-management/library-backend/app/controllers/cart.controller.js): 3 handler mỏng gọi service.
- Tạo [cart.validator.js](file:///e:/githudRepo/library-management/library-backend/app/validators/cart.validator.js): validate ObjectId cho body `bookId` và params `:bookId`.
- Tạo [cart.route.js](file:///e:/githudRepo/library-management/library-backend/app/routes/cart.route.js): `GET /cart`, `POST /cart/items`, `DELETE /cart/items/:bookId` — chỉ reader (`auth + requireRole('reader')`).
- Mount `/cart` vào [routes/index.js](file:///e:/githudRepo/library-management/library-backend/app/routes/index.js).

## File chính đã tạo/sửa
- `app/services/cart.service.js` (mới)
- `app/controllers/cart.controller.js` (mới)
- `app/validators/cart.validator.js` (mới)
- `app/routes/cart.route.js` (mới)
- `app/routes/index.js` (thêm mount `/cart`)
- `tasks/backend/BE-16.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100% (0 errors, 0 warnings).

## Đang dở / bước tiếp theo
1. Tiến hành task BE-17 theo `tasks/backend/BE-17.md`: notify.service (DB) và API thông báo của tôi.

## Quyết định mới / điểm cần nhớ
- `addItem` kiểm tra đủ 4 điều kiện: sách active, còn bản sao, chưa trùng trong giỏ, giỏ < `maxBooksPerLoan` (từ Settings).
- getCart populate sách + gắn cờ `available` cho FE biết sách còn/hết lúc hiển thị giỏ.

## Task kế tiếp đề xuất
- BE-17 (notify.service DB + API thông báo của tôi)
