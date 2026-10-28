# Quy tắc backend (áp dụng khi làm việc trong `library-backend/`)

> Gợi ý kích hoạt trong Antigravity: Glob `library-backend/**`.

- Luồng `route → middleware → controller → service → model`; controller mỏng, không gọi model trực tiếp.
- Validate mọi input bằng joi ở `validators/`; route gắn `auth`, `requireRole`, `validate`.
- Phản hồi `{ success, data, meta? }`; lỗi `ApiError`; không trả `passwordHash`, `tokenHash`.
- Transaction: `session.withTransaction`, truyền `{ session }` cho mọi truy vấn trong đó; gửi thông báo/emit **sau commit**.
- Tồn kho: `findOneAndUpdate({_id, availableCopies:{$gte:1}}, {$inc:{availableCopies:-1}})`.
- Danh sách phân trang (`limit` mặc định 12, tối đa 100), `lean()` khi chỉ đọc, `select` field cần thiết, tránh N+1.
- Thông báo chỉ tạo qua `notify.service.js` (lưu DB rồi emit Socket).
- Cấu hình chỉ đọc từ `app/config/index.js`. Không `process.env` rải rác.
- Ngày giờ lưu UTC; tính hạn theo ngày; tiền là số nguyên VND.
- Job idempotent. Ghi `auditLogs` cho thao tác nhạy cảm của staff/admin.
- Upload: multer memoryStorage, jpg/png/webp ≤ 2MB; thay/xóa ảnh gọi `destroy(publicId)`.
- Mỗi task backend kết thúc bằng: `npm run lint` sạch + kiểm tra tay (curl/Thunder Client/REST Client) hoặc test; ghi lệnh kiểm tra vào phần trả lời.
- Không thêm thư viện ngoài danh sách (docs/01 §2) khi chưa ghi lý do vào `context/decisions.md`.
