# Nhật ký quyết định (ADR rút gọn)

Định dạng: mã – ngày – quyết định – lý do. Khi đổi nghiệp vụ, thêm dòng mới (không xóa dòng cũ), rồi cập nhật tài liệu liên quan.

| Mã | Quyết định | Lý do |
|---|---|---|
| D-001 | Gia hạn: độc giả gửi yêu cầu, nhân viên/admin duyệt hoặc từ chối (có lý do) | Thư viện cần kiểm soát, tránh giữ sách vô hạn |
| D-002 | Chỉ độc giả đã nhận sách mới được đánh giá; vi phạm trả 403 | Đảm bảo đánh giá đáng tin |
| D-003 | Thông báo bằng Socket.IO + lưu DB; `notify.service` là điểm duy nhất tạo/emit | Realtime nhưng DB là nguồn sự thật; dễ kiểm soát |
| D-004 | Ảnh bìa/avatar lưu Cloudinary (`url` + `publicId`) | Backend không phụ thuộc đĩa, deploy ở đâu cũng được |
| D-005 | Phạt thanh toán tại quầy, nhân viên xác nhận; không thanh toán online | Phù hợp phạm vi đồ án |
| D-006 | Dùng MongoDB transaction (Atlas replica set) | Toàn vẹn tồn kho/phiếu/phạt |
| D-007 | Cấu hình hoàn toàn bằng biến môi trường, dev local, deploy dễ | Yêu cầu của chủ dự án |
| D-008 | Cấu trúc thư mục đơn giản, mở rộng từ mẫu contactbook | Yêu cầu của chủ dự án |
| D-009 | Giả định dùng Mongoose (chưa xác nhận) | Có schema/validate/populate; mẫu có `mongodb.util.js` |
| D-010 | Thêm `GET /health` và `POST /jobs/:name` (secret) | Hosting free "ngủ" làm `node-cron` không chạy |
| D-011 | Thêm `POST /me/avatar` vào bảng endpoint | File 04 §5.2 có nhắc nhưng bảng chưa liệt kê |
| D-012 | Dùng Google Antigravity: `AGENTS.md` + `GEMINI.md` + `.agent/rules` + `.agent/workflows` | Đây là công cụ làm đồ án của chủ dự án |
| D-013 | Chia 76 task nhỏ (BE-01…BE-38, FE-01…FE-38); làm hết Backend rồi Frontend; mỗi task một cuộc trò chuyện | Giảm ngữ cảnh mỗi phiên, dễ kiểm soát |
| D-014 | Bàn giao bằng `context/SESSION.md` (ghi đè) + `tasks/INDEX.md`; `/resume` chỉ nạp ngữ cảnh tối thiểu | Tiết kiệm token khi mở cuộc trò chuyện mới |
| D-015 | `context/digest.md` thay thế việc đọc toàn bộ docs trong phiên làm việc; phải luôn khớp docs | Giảm ~90% token nạp ngữ cảnh |
| D-016 | Hỗ trợ song song `.eslintrc.js` và `eslint.config.js` cùng devDependencies `@eslint/js`, `globals` | Node 24 / ESLint 10 mặc định dùng flat config format, cần thiết để `npm run lint` chạy trơn tru |
| D-017 | Đặt `language_override: 'none'` trong text index của `bookSchema` | Tránh MongoDB tự động đọc trường dữ liệu `language` (có giá trị 'Tiếng Việt') làm text analyzer gây lỗi `language override unsupported: Tiếng Việt` |
| D-018 | Sinh slug sách duy nhất tự tăng hậu tố `-1`, `-2`; chặn giảm `totalCopies` dưới số sách đang mượn (400); chặn xóa sách đã có lịch sử trong `loans` (409) | Đảm bảo tính toàn vẹn tồn kho, tránh trùng lặp URL và bảo toàn lịch sử giao dịch mượn trả |


