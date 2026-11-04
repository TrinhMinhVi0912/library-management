# Library Management Backend

REST API cho hệ thống quản lý mượn sách, xây dựng bằng Express 5, Mongoose, MongoDB và Socket.IO.

## Yêu cầu

- Node.js 20.19 trở lên và npm (theo yêu cầu của Mongoose 9).
- MongoDB replica set. Các luồng mượn, trả, gia hạn và phạt dùng transaction; MongoDB standalone không hỗ trợ các luồng này.
- Cloudinary và SMTP chỉ cần cấu hình nếu dùng upload ảnh hoặc gửi email thật.

## Cài đặt chạy local

```powershell
npm ci
Copy-Item .env.example .env
```

Mở `.env`, kiểm tra `MONGODB_URI`, đặt các giá trị bí mật local và cấu hình `CLIENT_URL`. Khởi động MongoDB replica set, sau đó chạy:

```powershell
npm run dev
```

Backend mặc định nghe tại `http://localhost:5000`. Kiểm tra `/health` và API gốc tại `/api/v1`. Swagger UI ở `/api/docs` khi `ENABLE_DOCS=true`.

## Cấu hình môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `NODE_ENV` | Không | `development`, `test` hoặc `production` |
| `PORT` | Không | Cổng HTTP, mặc định `5000` |
| `MONGODB_URI` | Có | URI MongoDB; production bắt buộc khai báo rõ; cần replica set để dùng transaction |
| `CLIENT_URL` | Có | Origin frontend, nhiều origin phân tách bằng dấu phẩy |
| `JWT_ACCESS_SECRET` | Có | Bí mật ký access token; production tối thiểu 32 ký tự |
| `JWT_REFRESH_SECRET` | Có | Bí mật ký refresh token, phải khác access secret; production tối thiểu 32 ký tự |
| `ACCESS_TOKEN_TTL` | Không | Thời hạn access token, mặc định `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | Không | Thời hạn refresh token theo ngày, mặc định `7` |
| `COOKIE_SECURE` | Không | Đặt `true` khi chạy HTTPS |
| `COOKIE_SAMESITE` | Không | `lax` mặc định; cross-site HTTPS thường cần `none` và `COOKIE_SECURE=true` |
| `CLOUDINARY_CLOUD_NAME` | Không | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Không | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Không | Cloudinary secret; chỉ lưu ở backend |
| `SMTP_HOST`, `SMTP_PORT` | Không | Máy chủ SMTP và cổng |
| `SMTP_USER`, `SMTP_PASS` | Không | Tài khoản SMTP/app password |
| `SMTP_FROM` | Không | Địa chỉ người gửi email |
| `JOBS_SECRET` | Có để gọi job ngoài | Gửi qua header `x-jobs-secret`; production tối thiểu 32 ký tự |
| `DISABLE_INTERNAL_CRON` | Không | Đặt `true` để tắt lịch `node-cron` nội bộ |
| `ENABLE_DOCS` | Không | Đặt `true` để bật Swagger tại `/api/docs`; nên tắt ở production nếu không cần công khai |

Khi `NODE_ENV=production`, backend từ chối khởi động nếu thiếu MongoDB URI, CLIENT_URL, JWT secrets hoặc JOBS_SECRET, hoặc nếu JWT/job secret quá ngắn. Không dùng giá trị mẫu trong `.env.example` cho production. Không commit `.env`.

## Scripts

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy backend với nodemon |
| `npm start` | Chạy backend production |
| `npm test -- --runInBand` | Chạy Jest/Supertest |
| `npm run lint` | Chạy ESLint |
| `npm run seed` | Nạp dữ liệu mẫu; chỉ dùng local/dev, không chạy trên production |
| `npm run create-admin` | Tạo admin đầu tiên; truyền `ADMIN_EMAIL`/`ADMIN_PASSWORD` hoặc `-- --email ... --password ...` |

Các test dùng model/session mocks và URI test fail-fast; chúng không kết nối DB dev hoặc production. Hiện bộ test chưa thay thế kiểm thử tích hợp với MongoDB replica set.

## API chính

Tất cả API chính dùng tiền tố `/api/v1`. Response thành công theo dạng `{ success: true, data, meta? }`; lỗi theo dạng `{ success: false, message, errors? }`.

| Nhóm | Endpoint tiêu biểu |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` |
| Sách | `GET /books`, `/books/:idOrSlug`, `/books/home`; đặt trước `POST /books/:bookId/reservations` |
| Độc giả | `GET /cart`, `POST /cart/items`, `POST /loans`, `GET /me/loans`, `GET /me/fines`, `GET /me/reservations` |
| Mượn trả quản trị | `/admin/loans` (duyệt, giao, trả), `/admin/renewals`, `/admin/fines` |
| Quản trị | `/admin/dashboard`, `/admin/books`, `/admin/users`, `/admin/settings`, `/admin/audit-logs` |
| Diễn đàn | `/forum/categories`, `/forum/threads`, `/forum/threads/:id/posts`, `/forum/reports` |
| Hệ thống | `GET /health`, `POST /jobs/:name`, `POST /api/v1/system/jobs/:name` |

Danh sách và tham số chi tiết xem trong Swagger UI hoặc `docs/04-api-va-cau-truc-du-an.md` tại repository gốc.

## Jobs định kỳ và chạy tay

Jobs nội bộ theo múi giờ `Asia/Ho_Chi_Minh`: `expirePickup` mỗi giờ, `markOverdue` lúc 00:05, `dueReminder` lúc 08:00, `expireReservation` mỗi giờ và `cleanup` Chủ nhật lúc 03:00. Đặt `DISABLE_INTERNAL_CRON=true` khi dùng scheduler bên ngoài.

Gọi một job thủ công bằng secret; thay giá trị placeholder bằng `JOBS_SECRET` trong `.env`:

```powershell
curl.exe -X POST http://localhost:5000/jobs/expirePickup -H "x-jobs-secret: your-local-jobs-secret"
```

Các job hợp lệ: `expirePickup`, `markOverdue`, `dueReminder`, `cleanup`, `expireReservation`. Endpoint trả `401` nếu secret thiếu/sai và `404` nếu tên job không hợp lệ. Có thể gọi endpoint tương đương dưới `/api/v1/system/jobs/:name`.

## Bảo mật

- Access token gửi qua Bearer; refresh token được rotate và lưu cookie httpOnly.
- CORS giới hạn theo `CLIENT_URL`; API có Helmet, giới hạn request chung, limiter riêng cho auth và đăng bài diễn đàn.
- Input được validate bằng Joi và làm sạch NoSQL; nội dung diễn đàn được sanitize trước khi lưu.
- `passwordHash` không được chọn mặc định và bị loại khỏi JSON; Cloudinary secret chỉ ở backend.
- Socket.IO yêu cầu JWT ở handshake. Thao tác dữ liệu kiểm tra vai trò và quyền sở hữu ở backend.
- Ảnh chỉ nhận JPG/PNG/WEBP và tối đa 2MB.

## Tài liệu

- Swagger UI: `/api/docs` khi bật `ENABLE_DOCS=true`.
- Quy ước API và biến môi trường: `../docs/04-api-va-cau-truc-du-an.md`.
- Checklist kiểm thử: `../docs/08-kiem-thu.md`.
