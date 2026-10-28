# DIGEST – Tóm tắt dự án cho agent (đọc file này thay cho đọc toàn bộ docs/)

> Mục đích: tiết kiệm token. Chỉ mở `docs/*` khi digest chưa đủ chi tiết; khi đó đọc **đúng mục** (dùng `grep -n '^#' file` rồi đọc khoảng dòng cần).
> Nếu digest mâu thuẫn `docs/` → `docs/` đúng, hãy sửa digest.

## D1. Dự án & quy tắc nghiệp vụ
Website quản lý mượn sách: độc giả tìm sách → giỏ mượn → gửi yêu cầu → nhân viên duyệt → giao → trả → phạt. Có gia hạn, đặt trước, đánh giá, kệ sách, thông báo realtime, diễn đàn, dashboard.

Chốt: gia hạn do độc giả yêu cầu, **nhân viên duyệt/từ chối (lý do)** · đánh giá chỉ khi **đã nhận sách** (403 nếu chưa) · **Socket.IO** + lưu DB · ảnh **Cloudinary** (`{url, publicId}`) · phạt **thu tại quầy** (không online) · **MongoDB transaction** · cấu hình hoàn toàn bằng **biến môi trường** (dev local, deploy dễ).

Mặc định (`settings`): tối đa 5 sách · mượn 14 ngày · gia hạn tối đa 2 lần × 7 ngày · giữ sách sau duyệt 3 ngày · giữ đặt trước 3 ngày · phạt trễ 2.000đ/ngày/quyển · mất sách = 100% đơn giá + 20.000đ · hỏng = 30–100% đơn giá (nhân viên nhập).
Điều kiện gửi yêu cầu gia hạn: item `borrowing`, chưa quá hạn, `renewCount < maxRenewals`, không có đặt trước `waiting`, không có yêu cầu `pending` cho cùng quyển.
Khóa mượn: user `locked`, hoặc `unpaidFineTotal > 0`, hoặc có item quá hạn.
Mã: `DG000001` (user) · `PM000001` (loan) · `S000001` (book) · `NXB001` — sinh từ `counters`.

## D2. Vai trò & quyền
- **Khách**: xem/tìm sách, đọc diễn đàn, đăng ký/đăng nhập.
- **Độc giả (reader)**: + giỏ, mượn, gia hạn, lịch sử, phạt của tôi, đánh giá (đã mượn), kệ, đặt trước, thông báo, hồ sơ, đăng/bình luận diễn đàn.
- **Nhân viên (staff)**: dashboard, duyệt mượn/gia hạn, giao/trả, ghi nhận & thu phạt, CRUD sách/danh mục, thông báo, kiểm duyệt diễn đàn, quản lý **độc giả** (khóa/mở).
- **Admin**: tất cả + quản lý nhân viên, đổi vai trò, miễn phạt, settings, audit logs.

## D3. Vòng đời trạng thái
- Loan: `pending → approved → borrowing → (overdue) → returned`; nhánh `rejected | cancelled | expired`. Item: `pending|borrowing|returned|lost`. Loan `returned` khi mọi item `returned/lost`.
- Fine: `unpaid → paid | waived(admin)`. Reservation: `waiting → available(giữ 3 ngày) → fulfilled|expired|cancelled`. Renewal: `pending → approved|rejected(lý do)|cancelled`.

## D4. Mô hình dữ liệu (rút gọn; chi tiết/ index: docs/02 §4)
- `users`: code, email(unique), passwordHash(select:false), role, firstName, lastName, birthDate, gender, address, phone, avatar{url,publicId}, position, status(active|locked), lockReason, unpaidFineTotal, lastLoginAt
- `publishers`{code,name,address} · `authors`{name,bio,photo} · `categories`{name,slug,description}
- `books`: code, title, slug, isbn, authors[], authorText, publisher, publishYear, price, totalCopies, availableCopies, categories[], language, pages, description, cover{url,publicId}, location, ratingAvg, ratingCount, borrowCount, status(active|hidden). Ràng buộc 0 ≤ available ≤ total. Text index `{title,authorText}` với `default_language:"none"`.
- `carts`{user unique, items[{book,addedAt}]}
- `loans`: code, reader, status, items[{book,titleSnapshot,priceSnapshot,status,borrowDate,dueDate,returnDate,renewCount,renewals[{at,oldDue,newDue,approvedBy}],condition}], requestNote, expectedPickupDate, pickupDeadline, rejectReason, approvedBy, handedOverBy, returnedBy, approvedAt, handedOverAt, closedAt
- `renewalRequests`: loan, book, reader, currentDueDate, requestedDueDate, reason, status, rejectReason, decidedBy, decidedAt · partial unique {loan,book} khi pending
- `fines`: reader, loan, book, type(late|damaged|lost|other), daysLate, amount, reason, status, recordedBy, paidAt, paidConfirmedBy, waivedReason
- `reservations`: reader, book, status, notifiedAt, holdUntil · partial unique {reader,book} khi waiting|available
- `reviews`: book, reader, rating 1–5, comment, hidden, hiddenBy · unique {book,reader}
- `shelves`: user, name, type(want|reading|read|custom), items[{book,addedAt}] · unique {user,name}
- `notifications`: recipient|null, audience(user|all|readers|staff), type, title, content, link, createdBy, expiresAt · `notificationReads`{user,notification,readAt}
- Forum: `forumCategories`{name,slug,description,order} · `forumThreads`{category,author,title,slug,content,book,tags,pinned,locked,replyCount,likeCount,viewCount,lastReplyAt,likes[],status} · `forumPosts`{thread,author,parent,content,likes[],likeCount,status} · `forumReports`{targetType,targetId,reporter,reason,status,handledBy}
- `settings`(1 doc) · `counters`{_id,seq} · `auditLogs`{actor,action,targetType,targetId,detail,ip} · `refreshTokens`{user,tokenHash,expiresAt(TTL),userAgent}

## D5. Endpoint (tiền tố `/api/v1`; chi tiết: docs/04 §3)
Phản hồi `{success,data,meta?}` / `{success:false,message,errors?}`; phân trang `?page&limit`, `sort=-createdAt`, `q`.
- **Auth/hồ sơ**: POST /auth/register|login|refresh|logout|forgot-password|reset-password · GET/PATCH /me · PATCH /me/password · POST /me/avatar
- **Sách (công khai)**: GET /books (q,category,author,publisher,year,available,sort) · /books/suggest · /books/home · /books/:idOrSlug · /books/:id/related · /books/:id/reviews · /categories · /authors(/:id) · /publishers
- **Độc giả**: /cart (GET), /cart/items (POST), /cart/items/:bookId (DELETE) · POST /loans · GET /me/loans(?status) · /me/loans/:id · POST /me/loans/:id/cancel · POST /me/loans/:id/items/:bookId/renewals · GET /me/renewals · POST /me/renewals/:id/cancel · GET /me/fines · POST /books/:id/reservations · GET /me/reservations · DELETE /me/reservations/:id · GET /books/:id/reviews/can-review · POST /books/:id/reviews · GET /me/reviews · PATCH|DELETE /reviews/:id · GET|POST /me/shelves · PATCH|DELETE /me/shelves/:id · POST|DELETE /me/shelves/:id/books/:bookId · GET /me/notifications(?unread) · /me/notifications/unread-count · PATCH /me/notifications/:id/read · /me/notifications/read-all
- **Diễn đàn**: GET /forum/categories · /forum/threads · /forum/threads/:idOrSlug · /forum/threads/:id/posts · POST /forum/threads · /forum/threads/:id/posts · PATCH|DELETE /forum/threads/:id · /forum/posts/:id · POST /forum/threads/:id/like · /forum/posts/:id/like · POST /forum/reports
- **Admin** (`/admin/*`, staff|admin): dashboard/summary, dashboard/charts · loans (list, :id, approve, reject, handover, return) · renewals (list, approve, reject) · counters · fines (list, POST, :id/pay, :id/waive[admin]) · CRUD books/authors/categories/publishers · POST /admin/uploads · users (list, :id, lock, unlock, POST[admin], :id/role[admin]) · CRUD notifications · forum (reports, threads/:id/pin|lock|hide, categories CRUD) · GET|PUT settings[admin] · GET audit-logs[admin] · reports/loans.xlsx, reports/fines.xlsx
- **Hệ thống**: GET /health · POST /jobs/:name (header `x-jobs-secret`)

## D6. Logic service (docs/04 §4)
- `submitLoan`: user active, nợ phạt = 0, không quá hạn; đang mượn+chờ+mới ≤ 5; tạo loan `pending` + snapshot; xóa giỏ; thông báo staff.
- `approveLoan` (TX): loan phải `pending`; mỗi sách `findOneAndUpdate({_id,availableCopies:{$gte:1}},{$inc:{availableCopies:-1}})`; thiếu → rollback; `approved`, `pickupDeadline=now+3d`; thông báo.
- `handoverLoan`: `approved→borrowing`, borrowDate=now, dueDate=now+14d mỗi item, `borrowCount++`.
- `requestRenewal`: kiểm tra điều kiện D1 → tạo `pending` → thông báo staff + emit `staff:counters`.
- `approveRenewal` (TX): kiểm tra lại → `dueDate+=7`, `renewCount++`, ghi `renewals[]`, request `approved`, thông báo. `rejectRenewal`: bắt buộc lý do.
- `returnItems` (TX): mỗi item good/damaged/lost; `daysLate=max(0,ceil((return−due)/1 ngày))`; tạo fines (trễ/hỏng/mất), cộng `unpaidFineTotal`; tồn kho: tốt `+1`, hỏng-còn-dùng `+1`, mất `totalCopies−1`; cập nhật trạng thái loan; tự hủy renewal pending của quyển; kích hoạt hàng chờ đặt trước; thông báo.
- `createReview`: cần loan có item của book ở `borrowing|returned|lost`, else 403; upsert {book,reader}; `recalcRating` (bỏ qua hidden).
- Quy tắc TX: truyền `{session}`; **thông báo/emit sau commit**. Phạt trễ tính khi trả; sách đang quá hạn hiển thị "phạt tạm tính" ở UI.

## D7. Socket.IO & Job
- Handshake `auth:{token}` verify JWT; rooms `user:<id>`, `role:staff` (+ `all`/`role:reader`). Server→client: `notification:new`, `staff:counters {pendingLoans,pendingRenewals}`, `loan:updated {loanId,status}`, `renewal:updated {requestId,status}`. Client không phát sự kiện nghiệp vụ. Chỉ `notify.service.js` tạo thông báo + emit.
- Job: `expirePickup` (mỗi giờ), `markOverdue` (00:05), `dueReminder` (08:00, đến hạn ≤ 2 ngày), `expireReservation` (mỗi giờ), `cleanup` (tuần). Phải idempotent; `POST /jobs/:name` + `DISABLE_INTERNAL_CRON`.
- Upload: multer memoryStorage, jpg/png/webp ≤ 2MB → `upload_stream` vào `library/books|avatars|authors`; đổi/xóa ảnh gọi `destroy(publicId)`.

## D8. Giao diện (docs/03)
Tokens: nền trắng, màu nhấn `#2563eb`, badge trạng thái thống nhất (`StatusBadge`), bo góc vừa, mobile-first. Hai layout: Public, Admin (sidebar).
- Route khách: `/`, `/books`, `/books/:slug`, `/authors/:id`, `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/forum`, `/forum/c/:slug`, `/forum/t/:slug`, `/about`, `/404`
- Độc giả: `/cart`, `/my/loans`, `/my/fines`, `/my/shelves`, `/my/reviews`, `/my/reservations`, `/notifications`, `/profile`, `/forum/new`
- Admin: `/admin`, `/admin/requests`, `/handover`, `/returns`, `/renewals`, `/loans`, `/fines`, `/books`, `/catalog`, `/users`, `/notifications`, `/forum`, `/settings`, `/audit-logs`
- Component: Khung(AppNavbar, AppFooter, AdminSidebar, AdminTopbar, PublicLayout, AdminLayout) · Sách(BookCard, BookRow, BookCarousel, BookFilterPanel, BookAvailability, RatingStars, RatingSummary, ReviewItem, ReviewForm) · Chung(SearchBar, Pagination, StatusBadge, EmptyState, SkeletonCard, ConfirmModal, FormModal, ImageUploader, DataTable, StatCard, ChartCard, DateRangePicker) · Mượn trả(CartItem, LoanCard, LoanTimeline, RenewRequestButton, RenewalRequestRow, ReturnItemRow, FineBadge) · Thông báo(NotificationBell, NotificationItem, RealtimeToast) · Diễn đàn(ThreadList, ThreadItem, PostItem, PostEditor, LikeButton, ReportModal)
- Tương tác: debounce 300ms tìm kiếm; bộ lọc trên URL; nút gia hạn vô hiệu có tooltip lý do (quá hạn / có đặt trước / hết lượt / đang chờ); hộp xác nhận khi từ chối/xóa/khóa/miễn phạt; toast realtime; 3 trạng thái mỗi trang (skeleton/empty/lỗi); guard `meta{requiresAuth,roles}`.
- Axios: gắn token, refresh khi 401, toast lỗi. Access token trong Pinia (memory); refresh qua cookie httpOnly (`withCredentials`).

## D9. Cấu trúc & môi trường
- Backend: `app/{config/index.js,controllers,models,routes,services,middlewares,validators,sockets,jobs,utils{mongodb,cloudinary,mailer,code,pagination}.util.js,api-error.js}`, `scripts/{seed,create-admin}.js`, `app.js`, `server.js`, `.env.example`.
- Frontend: `src/{assets,components/{common,book,loan,forum,admin},layouts,router/index.js,services/{api,socket,auth,book,loan,notification,forum,admin}.service.js,stores,views/{public,reader,forum,admin},App.vue,main.js}`.
- Luồng BE: `route → middleware → controller(mỏng) → service → model`. FE: view không gọi axios trực tiếp.
- Env backend: NODE_ENV, PORT, MONGODB_URI, CLIENT_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, COOKIE_SECURE, COOKIE_SAMESITE, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET, SMTP_*, JOBS_SECRET, DISABLE_INTERNAL_CRON, ENABLE_DOCS. Env frontend: VITE_API_URL, VITE_SOCKET_URL.
- Deploy: `trust proxy`, CORS theo CLIENT_URL, cookie secure/sameSite từ config, `/health`, SPA fallback. Chi tiết: docs/05.
