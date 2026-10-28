# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-15 – Seed dữ liệu danh mục & sách
- Trạng thái: ✅ xong

## Đã làm
- Mở rộng [scripts/seed.js](file:///e:/githudRepo/library-management/library-backend/scripts/seed.js) đầy đủ dữ liệu: 10 thể loại, 15 tác giả (có ảnh chân dung, bio), 5 nhà xuất bản (code NXB001..005), 60 cuốn sách (58 active, 2 hidden) gắn đúng tác giả/thể loại/NXB, ảnh bìa URL phong phú, `availableCopies <= totalCopies`, chỉ số đánh giá và lượt mượn.
- Bổ sung cơ chế dọn dẹp an toàn (`cleanSeedData`) xóa sách, thể loại, tác giả, NXB và reset Counter (`user`, `publisher`, `book`) để script chạy lại nhiều lần (re-runnable) mà không trùng mã.
- Tinh chỉnh [code.util.js](file:///e:/githudRepo/library-management/library-backend/app/utils/code.util.js) dùng `returnDocument: 'after'` loại bỏ cảnh báo deprecated của Mongoose.
- Kiểm tra thực tế: `npm run seed` tạo chuẩn 24 users, 10 categories, 15 authors, 5 publishers, 60 books; `GET /books` trả sách có ảnh bìa đầy đủ.

## File chính đã tạo/sửa
- `scripts/seed.js`
- `app/utils/code.util.js`
- `tasks/backend/BE-15.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100% (0 errors, 0 warnings).
- `npx jest tests/book.public.test.js tests/book.admin.test.js`: 47/47 passed.
- `npm run seed`: tạo thành công đầy đủ bản ghi, idempotent (chạy lại xóa sạch và tạo lại chuẩn xác).

## Đang dở / bước tiếp theo
1. Tiến hành task BE-16 theo `tasks/backend/BE-16.md`: Giỏ mượn (Giai đoạn B4 Mượn trả).

## Quyết định mới / điểm cần nhớ
- Khi chạy script seed trong môi trường phát triển cần quyền kết nối database MongoDB (BypassSandbox nếu chạy trên Windows host).

## Task kế tiếp đề xuất
- BE-16 (Giỏ mượn: Cart model, service thêm/xóa/xem giỏ sách)
