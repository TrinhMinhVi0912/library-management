# 04 – Thiết kế API & Cấu trúc dự án

## 1. Cấu trúc thư mục

Giữ đúng phong cách hai dự án mẫu (backend Express: `app/config, controllers, routes, services, utils`, `api-error.js`, `app.js`, `server.js`; frontend Vue + Vite: `src/assets, components, router, services, views`) và chỉ **bổ sung** những thư mục thật sự cần. Backend và frontend là **hai thư mục / hai repo riêng** để deploy độc lập.

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
│   │   ├── mailer.util.js        # gửi email (quên mật khẩu)
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

### 1.2 Frontend (`library-frontend/`)

```
library-frontend/
├── public/
├── src/
│   ├── assets/                   # styles/ (main.scss, biến Bootstrap), images/
│   ├── components/
│   │   ├── common/               # SearchBar, Pagination, StatusBadge, ConfirmModal, DataTable…
│   │   ├── book/                 # BookCard, BookCarousel, BookFilterPanel, RatingStars…
│   │   ├── loan/                 # CartItem, LoanCard, LoanTimeline, RenewRequestButton…
│   │   ├── forum/                # ThreadItem, PostItem, PostEditor…
│   │   └── admin/                # AdminSidebar, StatCard, ChartCard…
│   ├── layouts/                  # (mới) PublicLayout.vue, AdminLayout.vue
│   ├── router/
│   │   └── index.js              # routes + guard (requiresAuth, roles)
│   ├── services/                 # giống mẫu: api.service.js + một file cho mỗi nhóm API
│   │   ├── api.service.js        # axios instance, gắn token, tự refresh khi 401
│   │   ├── socket.service.js     # (mới) kết nối/ngắt Socket.IO, đăng ký sự kiện
│   │   ├── auth.service.js
│   │   ├── book.service.js
│   │   ├── loan.service.js       # giỏ, mượn, gia hạn, phạt của tôi
│   │   ├── notification.service.js
│   │   ├── forum.service.js
│   │   └── admin.service.js      # các API quản trị
│   ├── stores/                   # (mới) Pinia: auth, cart, notification, ui
│   ├── views/
│   │   ├── public/               # Home, BookList, BookDetail, Login, Register, About
│   │   ├── reader/               # Cart, MyLoans, MyFines, MyShelves, MyReviews, Notifications, Profile
│   │   ├── forum/                # ForumHome, ForumCategory, ThreadDetail, ThreadNew
│   │   ├── admin/                # Dashboard, Requests, Renewals, Handover, Returns, Fines, Books, Users…
│   │   └── NotFound.vue
│   ├── App.vue
│   └── main.js
├── .env.example                  # VITE_API_URL, VITE_SOCKET_URL
├── .gitignore
├── index.html
├── jsconfig.json                 # alias @ → src
├── vite.config.js
├── package.json
└── README.md
```

Mỗi `views/*` là một trang gắn với route; `components/*` là phần tái sử dụng. Mọi lệnh gọi API đi qua `services/*` (không gọi axios trực tiếp trong view).

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
| POST      | /auth/refresh                               | Cookie    | Cấp access token mới             |
| POST      | /auth/logout                                | Đăng nhập | Đăng xuất, thu hồi refresh token |
| POST      | /auth/forgot-password, /auth/reset-password | Khách     | Quên/đặt lại mật khẩu            |
| GET/PATCH | /me                                         | Đăng nhập | Xem/cập nhật hồ sơ               |
| PATCH     | /me/password                                | Đăng nhập | Đổi mật khẩu                     |
| POST      | /me/avatar                                  | Đăng nhập | Tải ảnh đại diện lên Cloudinary (multipart, ≤ 2MB) |

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
| GET          | /me/fines                                                                  | Phạt của tôi                                         |
| POST         | /books/:id/reservations, DELETE /me/reservations/:id, GET /me/reservations | Đặt trước                                            |
| GET          | /books/:id/reviews/can-review                                              | Kiểm tra đã mượn sách chưa (hiện/ẩn form đánh giá)   |
| POST         | /books/:id/reviews                                                         | Tạo/cập nhật đánh giá (**403 nếu chưa mượn sách**)   |
| GET          | /me/reviews                                                                | Đánh giá của tôi                                     |
| PATCH/DELETE | /reviews/:id                                                               | Sửa/xóa đánh giá của mình                            |
| GET/POST     | /me/shelves                                                                | Danh sách / tạo kệ                                   |
| PATCH/DELETE | /me/shelves/:id                                                            | Đổi tên / xóa kệ                                     |
| POST/DELETE  | /me/shelves/:id/books/:bookId                                              | Thêm / bỏ sách khỏi kệ                               |
| GET          | /me/notifications?unread=                                                  | Danh sách thông báo                                  |
| GET          | /me/notifications/unread-count                                             | Số chưa đọc                                          |
| PATCH        | /me/notifications/:id/read, /me/notifications/read-all                     | Đánh dấu đã đọc                                      |

### 3.4 Diễn đàn

| Method       | Path                                           | Quyền           | Mô tả                    |
| ------------ | ---------------------------------------------- | --------------- | ------------------------ |
| GET          | /forum/categories                              | Công khai       | Chuyên mục               |
| GET          | /forum/threads?category=&book=&q=&sort=        | Công khai       | Danh sách chủ đề         |
| GET          | /forum/threads/:idOrSlug                       | Công khai       | Chi tiết + tăng lượt xem |
| POST         | /forum/threads                                 | Đăng nhập       | Tạo chủ đề               |
| PATCH/DELETE | /forum/threads/:id                             | Chủ bài / staff | Sửa / xóa                |
| GET          | /forum/threads/:id/posts                       | Công khai       | Trả lời                  |
| POST         | /forum/threads/:id/posts                       | Đăng nhập       | Trả lời                  |
| PATCH/DELETE | /forum/posts/:id                               | Chủ bài / staff | Sửa / xóa                |
| POST         | /forum/threads/:id/like, /forum/posts/:id/like | Đăng nhập       | Thích/bỏ thích           |
| POST         | /forum/reports                                 | Đăng nhập       | Báo cáo vi phạm          |

### 3.5 Quản trị (`/admin/*`, role staff|admin)

| Method    | Path                                                               | Mô tả                                                              |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| GET       | /admin/dashboard/summary, /dashboard/charts?range=                 | Thống kê                                                           |
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
| CRUD      | /admin/books, /admin/authors, /admin/categories, /admin/publishers | Quản lý sách & danh mục                                            |
| POST      | /admin/uploads                                                     | Tải ảnh (multipart) lên Cloudinary → `{ url, publicId }`           |
| GET       | /admin/users                                                       | Danh sách người dùng                                               |
| GET/PATCH | /admin/users/:id                                                   | Xem / sửa                                                          |
| PATCH     | /admin/users/:id/lock, /unlock                                     | Khóa / mở khóa                                                     |
| POST      | /admin/users                                                       | Tạo nhân viên (admin)                                              |
| PATCH     | /admin/users/:id/role                                              | Đổi vai trò (admin)                                                |
| CRUD      | /admin/notifications                                               | Quản lý thông báo                                                  |
| GET/PATCH | /admin/forum/reports, /admin/forum/threads/:id/pin\|lock\|hide     | Kiểm duyệt                                                         |
| CRUD      | /admin/forum/categories                                            | Chuyên mục diễn đàn                                                |
| GET/PUT   | /admin/settings                                                    | Cấu hình (admin)                                                   |
| GET       | /admin/audit-logs                                                  | Nhật ký (admin)                                                    |
| GET       | /admin/reports/loans.xlsx, /reports/fines.xlsx                     | Xuất báo cáo                                                       |

### 3.6 Hệ thống (không cần đăng nhập người dùng)

| Method | Path | Bảo vệ | Mô tả |
| ------ | ---- | ------ | ----- |
| GET    | /health | Công khai | Trả `{ status: "ok", uptime }`; dùng cho health-check của hosting, kiểm tra kết nối DB nhẹ |
| POST   | /jobs/:name | Header `x-jobs-secret` = `JOBS_SECRET` | Chạy tay một job (`expirePickup`, `markOverdue`, `dueReminder`, `expireReservation`, `cleanup`). Dùng khi hosting free "ngủ" khiến `node-cron` không chạy: đặt cron-job.org / GitHub Actions gọi endpoint này theo lịch |

Ghi chú: `/health` và `/jobs/:name` nằm ngoài `/api/v1` hoặc trong `/api/v1/system` đều được; chọn một và ghi vào README backend.

## 4. Logic nghiệp vụ quan trọng (service)

**`submitLoan(userId, cartItems)`**

1. Kiểm tra user `active`, `unpaidFineTotal = 0`, không có item `overdue`.
2. `đang mượn + đang chờ + mới ≤ maxBooksPerLoan`.
3. Tạo `loans` `pending` với snapshot tên/giá; xóa giỏ; thông báo nhân viên.

**`approveLoan(loanId, staffId)`** (transaction)

1. Loan phải `pending`.
2. Với mỗi sách: `findOneAndUpdate({_id, availableCopies:{$gte:1}}, {$inc:{availableCopies:-1}})`; thiếu → rollback + trả lỗi nêu sách hết.
3. Loan `approved`, `pickupDeadline = now + pickupHoldDays`; thông báo.

**`handoverLoan(loanId, staffId)`**: `approved → borrowing`; đặt `borrowDate`, `dueDate`; tăng `borrowCount`.

**`requestRenewal(loanId, bookId, userId, reason)`**: kiểm tra chủ phiếu, item `borrowing`, chưa quá hạn, `renewCount < maxRenewals`, không có `reservations` `waiting`, chưa có yêu cầu `pending` → tạo `renewalRequests` `pending`, thông báo staff (Socket.IO) và đẩy `staff:counters`.

**`approveRenewal(requestId, staffId)`** (transaction): kiểm tra lại toàn bộ điều kiện → `dueDate += renewDays`, `renewCount += 1`, ghi `renewals[]`, request `approved`, thông báo độc giả. **`rejectRenewal(requestId, staffId, reason)`**: request `rejected`, thông báo độc giả.

**`returnItems(loanId, items, staffId)`** (transaction)

1. Cập nhật từng item; tính `daysLate = max(0, ceil((returnDate − dueDate)/1 ngày))`.
2. Tạo `fines` (trễ/hỏng/mất); cộng `unpaidFineTotal`.
3. Tồn kho: tốt/hỏng-vẫn-dùng `+1`; mất `totalCopies −1`.
4. Cập nhật trạng thái phiếu; kích hoạt hàng chờ đặt trước; thông báo.

**`createReview(userId, bookId, data)`**: kiểm tra `userId` có `loans.items` của `bookId` với trạng thái `borrowing`/`returned`/`lost` (nếu không → 403), upsert theo `{book, reader}`, rồi gọi `recalcRating`.

**`recalcRating(bookId)`**: aggregate `reviews` (không ẩn) → ghi `ratingAvg`, `ratingCount`.

## 5. Job định kỳ (node-cron)

| Job                 | Tần suất        | Việc làm                                                                    |
| ------------------- | --------------- | --------------------------------------------------------------------------- |
| `expirePickup`      | mỗi giờ         | `approved` quá `pickupDeadline` → `expired`, hoàn tồn kho, phục vụ hàng chờ |
| `markOverdue`       | 00:05 hằng ngày | item `borrowing` quá `dueDate` → phiếu `overdue`, thông báo                 |
| `dueReminder`       | 08:00 hằng ngày | Nhắc độc giả sách đến hạn trong 2 ngày                                      |
| `expireReservation` | mỗi giờ         | `available` quá `holdUntil` → `expired`, chuyển người kế                    |
| `cleanup`           | hằng tuần       | Xóa thông báo hết hạn, refresh token cũ                                     |

Phạt trễ tính **tại thời điểm trả**; với sách đang quá hạn, hiển thị "phạt tạm tính" ở giao diện nhưng chưa ghi vào `fines`.

## 5.1 Socket.IO (thông báo realtime)

- Khởi tạo trong `server.js` (gắn vào cùng HTTP server với Express), logic ở `app/sockets/index.js`.
- **Xác thực khi kết nối**: client gửi `auth: { token: accessToken }`; server verify JWT, từ chối nếu sai/hết hạn. Khi access token được làm mới, client kết nối lại với token mới.
- **Phòng (rooms)**: mỗi người vào `user:<id>`; nhân viên/admin vào thêm `role:staff`.
- **Sự kiện server → client**

| Sự kiện            | Gửi tới                       | Nội dung                                                   |
| ------------------ | ----------------------------- | ---------------------------------------------------------- |
| `notification:new` | `user:<id>` hoặc `role:staff` | Thông báo vừa tạo (tiêu đề, nội dung, link, loại)          |
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
- Upload: giới hạn loại tệp (jpg/png/webp), dung lượng ≤ 2MB, đổi tên tệp.
- Không trả `passwordHash`; log thao tác nhạy cảm vào `auditLogs`.
- Socket.IO: bắt buộc xác thực JWT khi handshake, `cors.origin` lấy từ `CLIENT_URL`, không tin dữ liệu client gửi lên socket.
- Cloudinary: khóa `API_SECRET` chỉ nằm ở backend (biến môi trường), không đưa vào frontend.

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
SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... MAIL_FROM=...
JOBS_SECRET=...                              # bảo vệ endpoint chạy job từ bên ngoài (xem file 05)

# library-frontend/.env  (production đặt trên nền tảng hosting)
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
2. **Gửi email** (quên mật khẩu) dùng dịch vụ nào: Gmail SMTP (app password), Brevo, Resend…? Nếu chưa cần có thể làm sau.
3. **Nơi deploy** dự kiến (Render/Railway/VPS…) để tinh chỉnh cấu hình – file 05 đang viết theo hướng tổng quát.
