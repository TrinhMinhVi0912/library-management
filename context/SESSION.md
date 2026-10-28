# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-11 – Scripts: create-admin và khung seed
- Trạng thái: ✅ xong

## Đã làm
- Xây dựng [create-admin.js](file:///e:/githudRepo/library-management/library-backend/scripts/create-admin.js): đọc email/password từ env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) hoặc args (`--email`, `--password`); tạo admin nếu chưa có; không in mật khẩu; chạy lại idempotent.
- Xây dựng [seed.js](file:///e:/githudRepo/library-management/library-backend/scripts/seed.js): từ chối production; đánh dấu seed bằng email domain `@seed.library.local`; xóa seed cũ trước khi tạo mới; seed 1 admin + 2 staff + 20 reader; mật khẩu chung `Seed@123`; khung mở rộng sẵn cho publishers/authors/categories/books/loans/forum.
- Sửa [code.util.js](file:///e:/githudRepo/library-management/library-backend/app/utils/code.util.js): `new: true` → `returnDocument: 'after'` (Mongoose 8 deprecation).

## File chính đã tạo/sửa
- `scripts/create-admin.js`
- `scripts/seed.js`
- `app/utils/code.util.js`
- `tasks/backend/BE-11.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100%.
- `node scripts/create-admin.js --email admin@library.test --password Admin@123`: tạo thành công, chạy lại bỏ qua.
- `node scripts/seed.js`: chạy 2 lần liên tiếp không lỗi, xóa 23 seed cũ → tạo 23 mới.
- `NODE_ENV=production node scripts/seed.js`: từ chối đúng.

## Đang dở / bước tiếp theo
1. Tiến hành task BE-12 theo `tasks/backend/BE-12.md`: Danh mục: tác giả, thể loại, NXB (CRUD + công khai).

## Quyết định mới / điểm cần nhớ
- Dữ liệu seed đánh dấu bằng email domain `@seed.library.local` → `cleanSeedData()` dùng regex xóa.
- `code.util.js` dùng `returnDocument: 'after'` thay vì `new: true` (Mongoose 8+).

## Task kế tiếp đề xuất
- BE-12 (Danh mục: tác giả, thể loại, NXB – CRUD + công khai)
