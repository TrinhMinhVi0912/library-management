# 06 – Quy ước lập trình (Coding Conventions)

Áp dụng cho cả người và AI agent. Mục tiêu: code **đơn giản, nhất quán, bám sát cấu trúc mẫu** (Express `app/...`, Vue `src/...`).

## 1. Chung
- Ngôn ngữ code: **JavaScript (ESM cho frontend, CommonJS cho backend theo mẫu hiện có)**. Nếu mẫu backend đang dùng `require`, giữ nguyên `require`.
- Tên biến/hàm/field/collection: **tiếng Anh**; comment, thông báo cho người dùng, message lỗi: **tiếng Việt**.
- Thụt lề 2 spaces, dấu nháy đơn, có dấu chấm phẩy theo `.eslintrc.js` của dự án. Chạy `npm run lint` trước khi commit.
- Không `console.log` thừa; dùng logger/morgan. Không commit `.env`, khóa, token.
- Không thêm thư viện ngoài danh sách ở file 01 mục 2 nếu chưa có lý do; nếu cần, ghi vào `context/decisions.md`.
- Mỗi thay đổi nhỏ, một mục đích; không refactor lan man.

## 2. Backend
### 2.1 Phân tầng (bắt buộc)
`route → middleware (auth, requireRole, validate) → controller → service → model`
- **Controller mỏng**: lấy dữ liệu từ `req`, gọi service, trả `res`. Không chứa nghiệp vụ, không gọi model trực tiếp.
- **Service** chứa toàn bộ nghiệp vụ, transaction, gọi `notify.service`.
- **Model** chỉ có schema, index, method thuần dữ liệu.
- Thông báo (DB + Socket.IO) **chỉ** tạo qua `notify.service.js`.

### 2.2 Đặt tên file
`<tên>.controller.js`, `<tên>.route.js`, `<tên>.service.js`, `<tên>.model.js`, `<tên>.validator.js`, `<tên>.util.js`, `<tên>.job.js`.

### 2.3 Định dạng phản hồi
- Thành công: `{ success: true, data, meta? }`.
- Lỗi: ném `new ApiError(status, message, errors?)`; `errorHandler` middleware chuyển thành `{ success:false, message, errors? }`.
- Không trả `passwordHash`, `tokenHash`, khóa nội bộ.
- Bắt lỗi async bằng wrapper (`asyncHandler`) hoặc `try/catch → next(err)`.

### 2.4 Mã trạng thái HTTP
200 OK, 201 Created, 204 No Content, 400 dữ liệu sai, 401 chưa đăng nhập/token hết hạn, 403 sai quyền hoặc vi phạm điều kiện nghiệp vụ (vd chưa mượn sách mà đánh giá), 404 không thấy, 409 xung đột (trùng, hết tồn kho), 422 validate thất bại, 429 quá giới hạn.

### 2.5 Validate & bảo mật
- Mọi route nhận input đều có schema `joi` ở `validators/`.
- Dùng `express-mongo-sanitize`, `helmet`, `cors` theo `CLIENT_URL`, rate-limit.
- Kiểm tra quyền sở hữu ở service (độc giả chỉ thao tác dữ liệu của mình).
- Nội dung diễn đàn: làm sạch (`sanitize-html`) trước khi lưu hoặc escape khi hiển thị.

### 2.6 Giao dịch (transaction)
Dùng `session.withTransaction` cho: duyệt, giao, trả, hủy/hết hạn, duyệt gia hạn. Mọi thao tác DB trong transaction phải truyền `{ session }`. Gửi thông báo/emit Socket **sau khi commit** (không emit trong transaction).

### 2.7 Truy vấn
- Danh sách luôn phân trang (`pagination.util.js`), mặc định `limit=12`, tối đa 100.
- Dùng `lean()` cho truy vấn chỉ đọc; chọn field cần thiết (`select`).
- Tránh N+1: dùng `populate` có chọn field hoặc aggregate.
- Cập nhật tồn kho bằng `findOneAndUpdate` có điều kiện `$gte`.

### 2.8 Cấu hình
Chỉ đọc biến môi trường qua `app/config/index.js`. Không dùng `process.env` rải rác.

## 3. Frontend
### 3.1 Cấu trúc & luồng
- View chỉ ghép giao diện và gọi **service** hoặc **store**; **không gọi axios trực tiếp trong view/component**.
- Mọi lời gọi API đi qua `src/services/*.service.js`, dùng chung instance ở `api.service.js`.
- Trạng thái dùng chung (auth, cart, notification, ui) ở Pinia `src/stores/`.
- Socket.IO chỉ khởi tạo ở `socket.service.js`; component nhận dữ liệu qua store.

### 3.2 Đặt tên
- Component/View: `PascalCase.vue` (`BookCard.vue`, `MyLoans.vue`).
- Service: `<tên>.service.js`; store: `<tên>.store.js` (`useAuthStore`).
- Route name: `kebab-case`; path theo file 03.
- Composable (nếu cần): `useXxx.js` trong `src/composables/`.

### 3.3 Vue
- Dùng `<script setup>` + Composition API.
- Props có kiểu; emit khai báo rõ.
- Mỗi trang xử lý đủ 3 trạng thái: **đang tải (skeleton)**, **rỗng (EmptyState có hướng dẫn)**, **lỗi (toast + nút thử lại)**.
- Hộp xác nhận (`ConfirmModal`) cho thao tác nguy hiểm: từ chối, xóa, khóa, miễn phạt.
- Trạng thái hiển thị bằng `StatusBadge` với bảng màu ở file 03 mục 2.

### 3.4 Giao diện
- Bootstrap 5 + SCSS ghi đè biến; token màu/bo góc theo file 03 mục 2. Không thêm màu mới tùy tiện.
- Mobile-first; bảng quản trị cuộn ngang trên màn hình nhỏ.
- Icon `bootstrap-icons`, có `aria-label` cho nút chỉ có icon.
- Debounce 300 ms cho ô tìm kiếm; lưu bộ lọc trên URL query.

### 3.5 Router & phân quyền
`meta: { requiresAuth, roles }`; guard chuyển `/login?redirect=…` hoặc 403. Việc ẩn nút ở UI **không thay thế** kiểm tra quyền ở backend.

## 4. Git
- Nhánh: `main` (ổn định), `develop` (tích hợp), `feature/<tên-ngắn>`, `fix/<tên-ngắn>`.
- Commit theo Conventional Commits, tiếng Anh hoặc Việt đều được, nhất quán: `feat(loan): duyệt gia hạn`, `fix(auth): refresh token hết hạn`, `docs: cập nhật file 04`.
- Pull request nhỏ, mô tả: làm gì, liên quan mục nào ở tài liệu, cách kiểm thử.
- Hai repo riêng: `library-backend`, `library-frontend`. Tài liệu (thư mục `docs/`, `context/`) để ở repo riêng hoặc nhân bản vào cả hai.

## 5. Xử lý ngày giờ & tiền
- Lưu ngày giờ dạng UTC (`Date`); hiển thị theo múi giờ `Asia/Ho_Chi_Minh` bằng `dayjs`.
- Hạn trả tính theo **ngày** (đặt về cuối ngày 23:59:59 giờ VN khi tính quá hạn).
- Tiền: số nguyên VND, không dùng số thực; định dạng hiển thị `1.000đ`.

## 6. Tài liệu & comment
- Hàm nghiệp vụ phức tạp có comment ngắn mô tả điều kiện/quy tắc kèm tham chiếu mục tài liệu (`// xem 01 §5`).
- Sửa nghiệp vụ → **cập nhật tài liệu cùng lúc** (xem `docs/07` mục 6 "Định nghĩa hoàn thành").
