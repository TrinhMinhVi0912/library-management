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
| D-019 | Thu/miễn phạt và cập nhật `unpaidFineTotal` cùng transaction; cung cấp hàm đối soát tổng unpaid fines (endpoint chỉ admin) | Tránh lệch khoản nợ khi cập nhật đồng thời và hỗ trợ sửa sai dữ liệu |
| D-020 | Admin/staff yêu cầu reset mật khẩu qua email bằng link reset một lần hiện có (`POST /admin/users/:id/password-reset`); staff chỉ được áp dụng với độc giả, tài khoản phải active | Tái sử dụng cơ chế token reset đã có và giữ nguyên giới hạn quyền quản lý người dùng |
| D-021 | Thông báo `all/readers/staff` dùng một document notifications và trạng thái đọc riêng qua `notificationReads`; realtime emit tới room tương ứng | Theo mô hình DB docs/02 §4.13 và tránh tạo bản sao thông báo cho từng người |
| D-022 | Dashboard charts hỗ trợ `7d`, `30d` (gom theo ngày) và `12m` (gom theo tháng), theo múi giờ Asia/Ho_Chi_Minh | Người dùng chốt bộ khoảng thời gian; mốc ngày/tháng khớp lịch địa phương |
| D-023 | Jobs thủ công hỗ trợ `POST /jobs/:name` và `/api/v1/system/jobs/:name`, xác thực bằng `x-jobs-secret`; mỗi job phải idempotent, nhắc hạn dùng `jobKey` duy nhất theo người dùng/ngày Việt Nam | Cho phép cron ngoài gọi endpoint an toàn và ngăn gửi nhắc trùng khi chạy đồng thời |
| D-024 | Giới hạn bài diễn đàn: tiêu đề 150, nội dung chủ đề 10.000, trả lời 5.000 ký tự | Người dùng chốt mức giới hạn trong BE-33 |
| D-025 | Reservation `available` giữ riêng một bản bằng cách giảm `availableCopies`; duyệt mượn cho đúng độc giả chuyển reservation sang `fulfilled` mà không trừ kho lần nữa; khi hết hạn/hủy thì chuyển người kế hoặc trả bản về kho | Người dùng xác nhận trong BE-35 để bảo đảm bản giữ không bị yêu cầu khác chiếm |
| D-026 | Tách frontend thành hai ứng dụng/thư mục riêng `library-frontend-user/` và `library-frontend-admin/`, mỗi app deploy thành site riêng nhưng dùng chung một backend; `CLIENT_URL` liệt kê cả hai origin | Người dùng yêu cầu user và admin có hai frontend/server riêng; cần kiểm tra refresh cookie trên domain production thật |
| D-027 | Hai frontend dùng chung design tokens và quy tắc bố cục trong docs/03; task UI không tự thêm theme, hiệu ứng trang trí hoặc phụ thuộc chéo source giữa hai app | Giữ giao diện nhất quán, tránh mỗi trang/app tự phát sinh một phong cách |
| D-028 | Thứ tự frontend: hoàn thành admin trước, sau đó user, cuối cùng rà soát/build/deploy cả hai; giữ nguyên ID và không tạo phụ thuộc chéo giả | Người dùng muốn hoàn thiện giao diện quản trị trước giao diện độc giả |
| D-029 | Frontend dùng ESLint flat config với `eslint-plugin-vue`, `@eslint/js` và `globals` để lint cả Vue SFC lẫn JavaScript | ESLint không phân tích cú pháp/template `.vue` nếu thiếu parser/plugin Vue; lint đầy đủ cần bộ tooling này |
| D-030 | Dashboard quản trị coi phiếu mượn có `pickupDeadline` trong 3 ngày tới là “sắp đến hạn nhận” | Người dùng chốt ngưỡng 3 ngày cho FE-20 |
| D-031 | Staff/admin được đọc riêng `lateFeePerDay`, `lostBookFeeRate`, `lostBookProcessingFee` qua `GET /api/v1/admin/loan-return-policy` để tính preview tiền phạt; API không trả hoặc cho sửa settings khác | Người dùng đồng ý mở rộng BE nhỏ trong FE-23 để staff có cùng preview chính xác với backend |


