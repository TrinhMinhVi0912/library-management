# 04 – Thiết kế API & Cấu trúc dự án

## 1. Cấu trúc thư mục

Giữ phong cách dự án mẫu. Hệ thống có **ba ứng dụng/repo deploy độc lập**: `library-backend/`, `library-frontend-user/`, `library-frontend-admin/`. Hai frontend là hai ứng dụng Vue + Vite riêng (hai package.json, hai build, hai static site/domain), cùng gọi một backend API và một Socket.IO server.

### 1.1 Backend (`library-backend/`)

```
library-backend/
├── app/
│   ├── config/
│   │   └── index.js              # đọc .env: PORT, MONGODB_URI, JWT, CLOUDINARY, CLIENT_URL…
│   ├── controllers/              # mỏng: nhận req → gọi service → trả res
│   │   ├── auth.controller.js
│   │   ├── book.controller.js
│   │   ├── catalog.controller.js         # tác giả, thể loại, NXB
│   │   ├── cart.controller.js
│   │   ├── loan.controller.js            # độc giả + admin (duyệt/giao/trả)
│   │   ├── renewal.controller.js         # yêu cầu & duyệt gia hạn
│   │   ├── fine.controller.js
│   │   ├── review.controller.js
│   │   ├── shelf.controller.js
│   │   ├── reservation.controller.js
│   │   ├── notification.controller.js
│   │   ├── forum.controller.js
│   │   ├── user.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── setting.controller.js
│   │   └── upload.controller.js
│   ├── models/                   # (mới) schema Mongoose cho các collection ở file 02
│   ├── routes/                   # auth.route.js, book.route.js, loan.route.js, admin.route.js…
│   ├── services/                 # toàn bộ nghiệp vụ (loan.service.js, fine.service.js, notify.service.js…)
│   ├── middlewares/              # (mới) auth, requireRole, validate, upload, errorHandler, rateLimit
│   ├── validators/               # (mới) schema joi cho từng route
│   ├── sockets/                  # (mới) index.js: khởi tạo Socket.IO, xác thực, phòng (rooms)
│   ├── jobs/                     # (mới) node-cron: expirePickup, markOverdue, dueReminder…
│   ├── utils/
│   │   ├── mongodb.util.js       # kết nối MongoDB (mongoose.connect)
│   │   ├── cloudinary.util.js    # cấu hình + hàm upload/xóa ảnh
│   │   ├── code.util.js          # sinh mã DG000001, PM000001…
│   │   └── pagination.util.js
│   └── api-error.js              # class ApiError (như mẫu)
├── scripts/
│   ├── seed.js                   # dữ liệu mẫu
│   └── create-admin.js           # tạo admin đầu tiên (dùng khi deploy)
├── app.js                        # tạo Express app: middleware + routes + error handler
├── server.js                     # tạo HTTP server, gắn Socket.IO, kết nối DB, chạy jobs
├── .env.example
├── .eslintrc.js
├── .gitignore
└── package.json
```

Luồng gọi: `route → (middleware auth/validate) → controller → service → model`. Controller không chứa nghiệp vụ.

### 1.2 Frontend độc giả (`library-frontend-user/`)

```text
library-frontend-user/
├── public/
├── src/
│   ├── assets/
│   ├── components/{common,book,loan,forum}/
│   ├── layouts/                  # PublicLayout.vue, ReaderLayout.vue
│   ├── router/index.js           # public/auth/reader/forum routes
│   ├── services/                 # api, auth, book/catalog, loan, notification, forum, shelf…
│   ├── stores/                   # auth, cart, notification, ui
│   ├── views/{public,reader,forum}/
│   ├── App.vue
│   └── main.js
├── .env.example                  # VITE_API_URL, VITE_SOCKET_URL
├── package.json
├── vite.config.js
└── README.md
```

Ứng dụng user sở hữu route công khai/auth, độc giả, catalog, đánh giá, kệ, đặt trước, thông báo và forum người dùng. Không đặt view/service/layout quản trị vào repo này.

### 1.3 Frontend quản trị (`library-frontend-admin/`)

```text
library-frontend-admin/
├── public/
├── src/
│   ├── assets/
│   ├── components/{common,book,loan,admin,forum}/
│   ├── layouts/                  # AdminLayout.vue
│   ├── router/index.js           # admin login/routes và role guards
│   ├── services/                 # api/auth, admin, book/catalog, loan, fine, notification, forum
│   ├── stores/                   # auth, ui, notification
│   ├── views/{auth,admin}/       # AdminLogin, Dashboard, Loans, Books, Users, Settings…
│   ├── App.vue
│   └── main.js
├── .env.example                  # VITE_API_URL, VITE_SOCKET_URL
├── package.json
├── vite.config.js
└── README.md
```

Ứng dụng admin sở hữu đăng nhập staff/admin, màn hình quản trị và kiểm duyệt forum. Các component dùng chung giữa hai ứng dụng được đặt/duy trì riêng trong mỗi repo cho tới khi có yêu cầu tạo package dùng chung; không import bằng đường dẫn tương đối chéo giữa hai ứng dụng.

Mỗi `views/*` là một trang gắn với route; `components/*` là phần tái sử dụng trong ứng dụng đó. Mọi lệnh gọi API đi qua `services/*` (không gọi axios trực tiếp trong view). Cả hai ứng dụng dùng cùng contract trong `docs/09-tai-lieu-api-frontend.md`.

## 2. Quy ước API

- Tiền tố `/api/v1`; JSON; mã lỗi HTTP chuẩn.
- Phản hồi thành công: `{ success: true, data, meta? }` (`meta` = `{ page, limit, total }`).
- Lỗi: `{ success: false, message, errors? }`.
- Phân trang `?page=1&limit=12`, sắp xếp `?sort=-createdAt`, tìm `?q=`.
- Xác thực: `Authorization: Bearer <accessToken>`; refresh token trong cookie httpOnly.

## 3. Danh sách endpoint

### 3.1 Auth & hồ sơ

| Method    | Path                                        | Quyền     | Mô tả                            |
| --------- | ------------------------------------------- | --------- | -------------------------------- |
| POST      | /auth/register                              | Khách     | Đăng ký độc giả                  |
| POST      | /auth/login                                 | Khách     | Đăng nhập                        |
| POST      | /auth/google                                | Khách     | Xác minh Google ID token, đăng nhập hoặc tạo độc giả; email trùng tài khoản thường không tự liên kết |
| POST      | /auth/refresh                               | Cookie    | Cấp access token mới             |
| POST      | /auth/logout                                | Đăng nhập | Đăng xuất, thu hồi refresh token |
| POST      | /auth/reset-password                       | Khách     | Đặt mật khẩu mới bằng mã do nhân viên cấp |
| GET/PATCH | /me                                         | Đăng nhập | Xem/cập nhật hồ sơ               |
| PATCH     | /me/password                                | Đăng nhập | Đổi mật khẩu                     |
| POST      | /me/avatar                                  | Đăng nhập | Tải ảnh đại diện lên Cloudinary (multipart, ≤ 2MB) |

`POST /auth/google` nhận `{ "idToken": "..." }` từ Google Identity Services. Backend xác minh chữ ký RS256, audience=`GOOGLE_CLIENT_ID`, issuer và hạn dùng bằng Google JWKS; chỉ chấp nhận email đã xác minh. Tài khoản mới chỉ có role `reader`; email đã thuộc tài khoản khác trả 409 và không tự liên kết. Thành công trả access token và refresh cookie httpOnly như đăng nhập thường.

### 3.2 Sách (công khai)

| Method | Path                                             | Mô tả                                                                                |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| GET    | /books                                           | Danh sách + tìm kiếm + lọc (`q, category, author, publisher, year, available, sort`) |
| GET    | /books/suggest?q=                                | Gợi ý tìm kiếm                                                                       |
| GET    | /books/home                                      | Dữ liệu trang chủ (mới, phổ biến, đánh giá cao)                                      |
| GET    | /books/:idOrSlug                                 | Chi tiết                                                                             |
| GET    | /books/:id/related                               | Sách tương tự                                                                        |
| GET    | /books/:id/reviews                               | Đánh giá của sách                                                                    |
| GET    | /categories, /authors, /authors/:id, /publishers | Danh mục                                                                             |

### 3.3 Độc giả

| Method       | Path                                                                       | Mô tả                                                |
| ------------ | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| GET          | /cart                                                                      | Xem giỏ                                              |
| POST         | /cart/items                                                                | Thêm `{ bookId }`                                    |
| DELETE       | /cart/items/:bookId                                                        | Xóa                                                  |
| POST         | /loans                                                                     | Gửi yêu cầu mượn từ giỏ (`expectedPickupDate, note`) |
| GET          | /me/loans?status=                                                          | Lịch sử mượn                                         |
| GET          | /me/loans/:id                                                              | Chi tiết phiếu                                       |
| POST         | /me/loans/:id/cancel                                                       | Hủy phiếu `pending/approved`                         |
| POST         | /me/loans/:id/items/:bookId/renewals                                       | Gửi yêu cầu gia hạn `{ reason? }`                    |
| GET          | /me/renewals?status=                                                       | Yêu cầu gia hạn của tôi                              |
| POST         | /me/renewals/:id/cancel                                                    | Hủy yêu cầu gia hạn đang chờ                         |
| POST         | /me/loans/:id/items/:bookId/renewals                                      | Gửi `{ reason? }`; lỗi có mã như `RENEW_OVERDUE`, `RENEW_LIMIT_REACHED`, `RENEW_RESERVED`, `RENEW_PENDING` |
| GET          | /me/fines                                                                  | Phạt của tôi                                         |
| POST         | /books/:id/reservations                                          | Đặt trước khi `availableCopies=0`; thêm vào cuối hàng FIFO |
| GET          | /me/reservations?status=&page=&limit=                             | Danh sách lượt đặt trước, gồm vị trí trong hàng chờ       |
| DELETE       | /me/reservations/:id                                              | Hủy lượt chờ/đang giữ; bản giữ được chuyển người kế       |
| GET          | /books/:id/reviews/can-review                                              | Kiểm tra đã mượn sách chưa (hiện/ẩn form đánh giá)   |
| POST         | /books/:id/reviews                                                         | Tạo/cập nhật đánh giá (**403 nếu chưa mượn sách**)   |
| GET          | /me/reviews                                                                | Đánh giá của tôi                                     |
| PATCH/DELETE | /reviews/:id                                                               | Sửa/xóa đánh giá của mình                            |
| PATCH        | /admin/reviews/:id/visibility                                             | Nhân viên/admin ẩn hoặc hiện đánh giá `{ hidden }`    |
| GET/POST     | /me/shelves                                                                | Danh sách / tạo kệ                                   |
| PATCH/DELETE | /me/shelves/:id                                                            | Đổi tên / xóa kệ                                     |
| POST/DELETE  | /me/shelves/:id/books/:bookId                                              | Thêm / bỏ sách khỏi kệ                               |
Khi đăng ký và khi tải `/me/shelves`, hệ thống bảo đảm đủ 3 kệ mặc định (*Muốn đọc*, *Đang đọc*, *Đã đọc*). Chỉ kệ tùy chỉnh được đổi tên hoặc xóa; thêm sách trùng trong cùng kệ trả 409.
| GET          | /me/notifications?unread=                                                  | Danh sách thông báo                                  |
| GET          | /me/notifications/unread-count                                             | Số chưa đọc                                          |
| PATCH        | /me/notifications/:id/read, /me/notifications/read-all                     | Đánh dấu đã đọc                                      |

### 3.4 Diễn đàn

| Method       | Path                                           | Quyền           | Mô tả                    |
| ------------ | ---------------------------------------------- | --------------- | ------------------------ |
| GET          | /forum/categories                              | Công khai       | Chuyên mục               |
| GET          | /forum/threads?category=&book=&q=&sort=        | Công khai       | Danh sách chủ đề; sort `active`, `latest`, `popular`, `views` |
| GET          | /forum/my/threads?page=&limit=&q=              | Đăng nhập       | Chủ đề của tài khoản hiện tại, gồm chủ đề đã ẩn; phân trang |
| GET          | /forum/my/threads/:id                           | Chủ bài         | Chi tiết chủ đề của chính tài khoản hiện tại, kể cả đã ẩn |
| GET          | /forum/threads/:idOrSlug                       | Công khai       | Chi tiết + tăng lượt xem |
| POST         | /forum/threads                                 | Đăng nhập       | Tạo chủ đề; tiêu đề tối đa 150, nội dung tối đa 10.000 ký tự |
| PATCH/DELETE | /forum/threads/:id                             | Chủ bài / staff | Sửa / xóa                |
| GET          | /forum/threads/:id/posts                       | Công khai       | Trả lời                  |
| POST         | /forum/threads/:id/posts                       | Đăng nhập       | Trả lời tối đa 5.000 ký tự; hỗ trợ lồng tối đa một cấp; giới hạn 5 lần/phút/IP |
| PATCH/DELETE | /forum/posts/:id                               | Chủ bài / staff | Sửa / xóa                |
| POST         | /forum/threads/:id/like, /forum/posts/:id/like | Đăng nhập       | Thích/bỏ thích           |
| POST         | /forum/reports                                 | Đăng nhập       | Báo cáo vi phạm          |

Chủ bài hoặc staff/admin được sửa/xóa; thao tác xóa chuyển nội dung sang `hidden` để giữ tham chiếu. Nội dung thread/post được làm sạch bằng `sanitize-html`; tài khoản bị khóa không thể đăng do middleware xác thực.

Admin/staff: `GET /admin/forum/reports?status=&targetType=&page=&limit=` (mặc định `status=open`); `PATCH /admin/forum/reports/:id` với `status=resolved|dismissed`; `PATCH /admin/forum/threads/:id/pin` (`pinned` boolean), `/lock` (`locked` boolean), `/hide` (`hidden:true`); ẩn post bằng `PATCH /admin/forum/posts/:id/hide` (`hidden:true`) hoặc `DELETE /admin/forum/posts/:id`. Các thao tác xử lý/kiểm duyệt ghi audit; xử lý report ghi `handledBy`.

### 3.5 Quản trị (`/admin/*`, role staff|admin)

| Method    | Path                                                               | Mô tả                                                              |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| GET       | /admin/dashboard/summary                                          | Tổng sách/bản, độc giả, mượn, quá hạn, yêu cầu chờ, tổng phạt chưa thu |
| GET       | /admin/dashboard/charts?range=7d\|30d\|12m                         | Lượt giao sách theo thời gian, top 10 sách, thể loại, tiền phạt đã thu (mặc định `30d`) |
| GET       | /admin/loans?status=&q=&from=&to=                                  | Tất cả phiếu mượn                                                  |
| GET       | /admin/loans/:id                                                   | Chi tiết phiếu                                                     |
| POST      | /admin/loans/:id/approve                                           | Duyệt                                                              |
| POST      | /admin/loans/:id/reject                                            | Từ chối `{ reason }`                                               |
| POST      | /admin/loans/:id/handover                                          | Xác nhận giao sách                                                 |
| POST      | /admin/loans/:id/return                                            | Xác nhận trả `{ items:[{bookId, condition, fineAmount?, note?}] }` |
| GET       | /admin/renewals?status=pending                                     | Hàng đợi yêu cầu gia hạn                                           |
| POST      | /admin/renewals/:id/approve                                        | Duyệt gia hạn                                                      |
| POST      | /admin/renewals/:id/reject                                         | Từ chối `{ reason }`                                               |
| GET       | /admin/counters                                                    | Số yêu cầu mượn/gia hạn chờ duyệt (đồng bộ badge)                  |
| GET       | /admin/fines                                                       | Danh sách phạt                                                     |
| POST      | /admin/fines                                                       | Ghi nhận phạt thủ công                                             |
| PATCH     | /admin/fines/:id/pay                                               | Xác nhận đã thu tiền tại quầy                                      |
| PATCH     | /admin/fines/:id/waive                                             | Miễn phạt (admin)                                                  |
| POST      | /admin/fines/recalculate                                           | Đối soát `unpaidFineTotal` (admin; body tùy chọn `{ reader }`)      |
| CRUD      | /admin/books, /admin/authors, /admin/categories, /admin/publishers | Quản lý sách & danh mục                                            |
| POST      | /admin/uploads                                                     | Tải ảnh (multipart) lên Cloudinary → `{ url, publicId }`           |
| GET       | /admin/users                                                       | Danh sách người dùng                                               |
| GET/PATCH | /admin/users/:id                                                   | Xem / sửa                                                          |
| PATCH     | /admin/users/:id/lock, /unlock                                     | Khóa / mở khóa                                                     |
| POST      | /admin/users                                                       | Tạo nhân viên (admin)                                              |
| PATCH     | /admin/users/:id/role                                              | Đổi vai trò (admin)                                                |
| POST      | /admin/users/:id/password-reset                                    | Cấp mã 128-bit dùng một lần cho tài khoản active; staff theo quyền quản lý, admin mọi tài khoản active |
| GET       | /admin/notifications?audience=&type=&q=&page=&limit=               | Danh sách thông báo, lọc và phân trang                              |
| GET       | /admin/notifications/:id                                           | Chi tiết thông báo                                                 |
| POST      | /admin/notifications                                               | Tạo thông báo cá nhân hoặc theo nhóm                               |
| PATCH     | /admin/notifications/:id                                           | Sửa và phát realtime tới phòng nhận                                |
| DELETE    | /admin/notifications/:id                                           | Xóa thông báo và trạng thái đã đọc                                 |
| GET/PATCH | /admin/forum/reports, /admin/forum/reports/:id                     | Danh sách và xử lý báo cáo                                         |
| PATCH     | /admin/forum/threads/:id/pin\|lock\|hide, /admin/forum/posts/:id/hide | Ghim/khóa/ẩn chủ đề hoặc ẩn bài trả lời                             |
| DELETE    | /admin/forum/posts/:id                                             | Ẩn bài trả lời và lưu audit                                        |
| CRUD      | /admin/forum/categories                                            | Chuyên mục diễn đàn                                                |
| GET/PUT   | /admin/settings                                                    | Xem/cập nhật quy tắc mượn, gia hạn và mức phạt (admin)             |
| GET       | /admin/audit-logs                                                  | Nhật ký, lọc `actor`, `action`, `from`, `to`; phân trang (admin)    |
| GET       | /admin/reports/loans.xlsx?from=&to=, /reports/fines.xlsx?from=&to= | Excel tiếng Việt, lọc `createdAt` theo khoảng ISO (tùy chọn)       |

### 3.6 Hệ thống (không cần đăng nhập người dùng)

| Method | Path | Bảo vệ | Mô tả |
| ------ | ---- | ------ | ----- |
| GET    | /health | Công khai | Trả `{ status: "ok", uptime }`; dùng cho health-check của hosting, kiểm tra kết nối DB nhẹ |
| POST   | /jobs/:name | Header `x-jobs-secret` = `JOBS_SECRET` | Chạy tay một job (`expirePickup`, `markOverdue`, `dueReminder`, `cleanup`); `expireReservation` được bổ sung ở BE-35. Hỗ trợ `/jobs/:name` và `/api/v1/system/jobs/:name`. Dùng khi hosting free "ngủ" khiến `node-cron` không chạy: đặt cron-job.org / GitHub Actions gọi endpoint này theo lịch |

Ghi chú: `/health` công khai; hai đường dẫn gọi job đều yêu cầu secret.

## 4. Logic nghiệp vụ quan trọng (service)

**`submitLoan(userId, cartItems)`**

1. Kiểm tra user `active`, `unpaidFineTotal = 0`, không có item `overdue`.
2. `đang mượn + đang chờ + mới ≤ maxBooksPerLoan`.
3. Tạo `loans` `pending` với snapshot tên/giá; xóa giỏ; thông báo nhân viên.

**`approveLoan(loanId, staffId)`** (transaction)

1. Loan phải `pending`.
2. Với mỗi sách, nếu độc giả có reservation `available` còn hạn thì chuyển reservation sang `fulfilled` và không trừ kho lần nữa; nếu không có thì giảm tồn nguyên tử bằng `findOneAndUpdate({_id, availableCopies:{$gte:1}}, {$inc:{availableCopies:-1}})`; thiếu → rollback + trả lỗi nêu sách hết.
3. Loan `approved`, `pickupDeadline = now + pickupHoldDays`; thông báo.

**`handoverLoan(loanId, staffId)`**: `approved → borrowing`; đặt `borrowDate`, `dueDate`; tăng `borrowCount`.

**`requestRenewal(loanId, bookId, userId, reason)`**: kiểm tra chủ phiếu, item `borrowing`, chưa quá hạn, `renewCount < maxRenewals`, không có `reservations` `waiting`, chưa có yêu cầu `pending` → tạo `renewalRequests` `pending`, thông báo staff (Socket.IO) và đẩy `staff:counters`.

**`approveRenewal(requestId, staffId)`** (transaction): kiểm tra lại item đang mượn, chưa quá hạn, còn lượt và chưa có đặt trước waiting → `dueDate += renewDays`, `renewCount += 1`, ghi `renewals[]`, request `approved`. Sau commit: thông báo, emit `renewal:updated`, `loan:updated`, staff counters và audit. **`rejectRenewal(requestId, staffId, reason)`**: lý do bắt buộc; request `rejected`, sau commit thông báo, emit trạng thái, counters và audit.

**`returnItems(loanId, items, staffId)`** (transaction)

1. Cập nhật từng item; tính `daysLate = max(0, ceil((returnDate − dueDate)/1 ngày))`.
2. Tạo `fines` (trễ/hỏng/mất); cộng `unpaidFineTotal`.
3. Tồn kho: tốt/hỏng-vẫn-dùng `+1`; mất `totalCopies −1`. Nếu có người chờ, bản trả được giữ cho người đầu FIFO trong cùng transaction và giảm lại `availableCopies`.
4. Cập nhật trạng thái phiếu; sau commit thông báo cho người được giữ sách.

**Reservation FIFO:** bản được offer đặt trạng thái `available`, ghi `notifiedAt` và `holdUntil=now+reservationHoldDays`; bản này không còn trong kho công khai. `expireReservation` chạy mỗi giờ: lượt hết hạn chuyển `expired`, bản được chuyển cho người kế hoặc trả về kho nếu hàng chờ trống. Hủy lượt `available` cũng chuyển bản; hủy phiếu mượn đã duyệt và `expirePickup` đưa bản hoàn về qua cùng FIFO.

**`createReview(userId, bookId, data)`**: kiểm tra `userId` có cùng phần tử `loans.items` cho `bookId` với trạng thái `borrowing`/`returned`/`lost` (nếu không → 403), upsert theo `{book, reader}`, rồi gọi `recalcRating`. Chỉ chủ được sửa/xóa; nhân viên/admin có thể ẩn/hiện qua endpoint quản trị.

**`recalcRating(bookId)`**: aggregate `reviews` (không ẩn) → ghi `ratingAvg`, `ratingCount`.

## 5. Job định kỳ (node-cron)

| Job                 | Tần suất        | Việc làm                                                                    |
| ------------------- | --------------- | --------------------------------------------------------------------------- |
| `expirePickup`      | đầu mỗi giờ (`0 * * * *`) | `approved` quá `pickupDeadline` → `expired`, hoàn kho và kích hoạt hàng chờ đặt trước trong transaction, thông báo |
| `markOverdue`       | 00:05 hằng ngày (`5 0 * * *`) | item `borrowing` quá `dueDate` → phiếu `overdue`, thông báo |
| `dueReminder`       | 08:00 hằng ngày (`0 8 * * *`) | Nhắc độc giả sách đến hạn trong 2 ngày; tối đa một lần/người/ngày |
| `expireReservation` | mỗi giờ         | BE-35: `available` quá `holdUntil` → `expired`, chuyển người kế |
| `cleanup`           | Chủ nhật 03:00 (`0 3 * * 0`) | Xóa thông báo hết hạn cùng bản ghi đã đọc và refresh token hết hạn |

Lịch nội bộ dùng timezone `Asia/Ho_Chi_Minh`; có thể tắt bằng `DISABLE_INTERNAL_CRON=true`. Endpoint thủ công trả 401 nếu thiếu/sai `JOBS_SECRET`.

Phạt trễ tính **tại thời điểm trả**; với sách đang quá hạn, hiển thị "phạt tạm tính" ở giao diện nhưng chưa ghi vào `fines`.

## 5.1 Socket.IO (thông báo realtime)

- Khởi tạo trong `server.js` (gắn vào cùng HTTP server với Express), logic ở `app/sockets/index.js`.
- **Xác thực khi kết nối**: client gửi `auth: { token: accessToken }`; server verify JWT, từ chối nếu sai/hết hạn. Khi access token được làm mới, client kết nối lại với token mới.
- **Phòng (rooms)**: mỗi người vào `user:<id>`; nhân viên/admin vào thêm `role:staff`.
- **Sự kiện server → client**

| Sự kiện            | Gửi tới                       | Nội dung                                                   |
| ------------------ | ----------------------------- | ---------------------------------------------------------- |
| `notification:new` | `user:<id>`, `all`, `role:reader`, `role:staff` | Thông báo vừa tạo (tiêu đề, nội dung, link, loại)  |
| `notification:updated` | Phòng người nhận tương ứng | Thông báo đã được sửa                                     |
| `notification:deleted` | Phòng người nhận tương ứng | Thông báo bị xóa khỏi danh sách nhận                      |
| `staff:counters`   | `role:staff`                  | `{ pendingLoans, pendingRenewals }` để cập nhật badge      |
| `loan:updated`     | `user:<id>`                   | `{ loanId, status }` để làm mới trang lịch sử mượn đang mở |
| `renewal:updated`  | `user:<id>`                   | `{ requestId, status }`                                    |

- `notify.service.js` là **điểm duy nhất** tạo thông báo: lưu DB → emit Socket. Không emit rải rác trong controller.
- Client không phát sự kiện nghiệp vụ lên server; mọi hành động vẫn đi qua REST API (dễ kiểm soát quyền và kiểm thử).
- Thông báo chung (`audience: all/readers`) emit tới phòng chung `all`/`role:reader`.

## 5.2 Upload ảnh với Cloudinary

1. Frontend gửi file (multipart) tới `POST /admin/uploads` (hoặc `/me/avatar`).
2. `multer` dùng `memoryStorage`, giới hạn jpg/png/webp, ≤ 2MB.
3. Backend upload bằng `cloudinary.uploader.upload_stream` vào thư mục `library/books` (hoặc `library/avatars`, `library/authors`), trả về `{ url: secure_url, publicId }`.
4. Lưu `url` + `publicId` vào document; khi thay/xóa ảnh thì gọi `cloudinary.uploader.destroy(publicId)`.
5. Hiển thị thumbnail dùng URL biến đổi (ví dụ thêm `f_auto,q_auto,w_300`) để tải nhanh.
6. Lưu ảnh ở Cloudinary giúp backend không phụ thuộc đĩa cục bộ, nên deploy lên hosting nào cũng được.

## 6. Bảo mật

- Băm mật khẩu `bcryptjs` (cost 10–12); kiểm tra độ mạnh.
- JWT access ngắn hạn + refresh httpOnly, `SameSite=Lax`, đổi (rotate) khi làm mới.
- `helmet`, `cors` theo origin cấu hình, `express-rate-limit` (nghiêm hơn cho `/auth/*` và đăng bài diễn đàn).
- Validate mọi input (joi/zod), chống NoSQL injection (`express-mongo-sanitize`), làm sạch nội dung diễn đàn (escape/`sanitize-html`, không render HTML thô).
- Kiểm tra quyền sở hữu (độc giả chỉ thao tác dữ liệu của mình), kiểm tra role ở middleware.
- Upload: giới hạn loại tệp (jpg/png/webp), dung lượng ≤ 2MB, đổi tên tệp. Nội dung đánh giá được lưu dạng text đã làm sạch; diễn đàn chỉ giữ các thẻ HTML an toàn.
- Không trả `passwordHash`; log thao tác nhạy cảm vào `auditLogs`.
- Socket.IO: bắt buộc xác thực JWT khi handshake, `cors.origin` lấy từ `CLIENT_URL`, không tin dữ liệu client gửi lên socket.
- Cloudinary: khóa `API_SECRET` chỉ nằm ở backend (biến môi trường), không đưa vào frontend.
- Khi `NODE_ENV=production`, bắt buộc khai báo MongoDB URI, CLIENT_URL, JWT access/refresh secrets riêng biệt (mỗi secret tối thiểu 32 ký tự) và JOBS_SECRET tối thiểu 32 ký tự; backend từ chối secret mẫu.

## 7. Biến môi trường mẫu

```
# library-backend/.env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/library?retryWrites=true&w=majority
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
CLIENT_URL=http://localhost:5173            # nhiều origin: ngăn cách bằng dấu phẩy
COOKIE_SAMESITE=lax                          # production khác domain: none
COOKIE_SECURE=false                          # production: true
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
JOBS_SECRET=...                              # bảo vệ endpoint chạy job từ bên ngoài (xem file 05)

# Mỗi app `library-frontend-user/.env` và `library-frontend-admin/.env`
# (production đặt biến riêng trên hosting của từng static site)
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

Tất cả giá trị cấu hình đọc qua `app/config/index.js`, **không** hard-code URL/khóa trong code. Chi tiết deploy ở file **05-trien-khai-deploy.md**.

## 8. Kiểm thử & tài liệu

- Backend: Jest + Supertest cho luồng chính (đăng ký → giỏ → mượn → duyệt → giao → yêu cầu gia hạn → duyệt gia hạn → trả → phạt → xác nhận thu).
- Tài liệu API: Swagger UI tại `/api/docs` (có thể tắt ở production).
- Frontend: kiểm thử thủ công theo checklist vai trò; tùy chọn Vitest cho store/service.
- Script: `npm run dev`, `npm start`, `npm run seed`, `npm run create-admin`, `npm run lint`.

## 9. Điểm còn lại cần xác nhận

1. **Mongoose hay driver `mongodb` thuần?** Mẫu hiện tại có `mongodb.util.js` (nhiều khả năng dùng driver thuần). Tài liệu này giả định **Mongoose** (có schema, validate, populate; vẫn dùng được `mongodb.util.js` để kết nối). Nếu bạn muốn giữ driver thuần như mẫu thì bỏ `models/` và viết truy vấn trong `services/`.
2. **Khôi phục mật khẩu:** độc giả xác minh danh tính trực tiếp tại quầy; staff/admin cấp mã dùng một lần. Không gửi email.
3. **Nơi deploy** dự kiến (Render/Railway/VPS…) để tinh chỉnh cấu hình – file 05 đang viết theo hướng tổng quát.
