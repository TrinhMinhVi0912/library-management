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
| `COOKIE_SECURE` | Có trong production | Đặt `true` khi chạy HTTPS; production từ chối nếu không bật |
| `COOKIE_SAMESITE` | Có trong production | Chọn `lax`, `strict` hoặc `none` theo domain; cross-site HTTPS thường cần `none` |
| `CLOUDINARY_CLOUD_NAME` | Không | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Không | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Không | Cloudinary secret; chỉ lưu ở backend |
| `SMTP_HOST`, `SMTP_PORT` | Không | Máy chủ SMTP và cổng |
| `SMTP_USER`, `SMTP_PASS` | Không | Tài khoản SMTP/app password |
| `SMTP_FROM` | Không | Địa chỉ người gửi email |
| `JOBS_SECRET` | Có để gọi job ngoài | Gửi qua header `x-jobs-secret`; production tối thiểu 32 ký tự |
| `DISABLE_INTERNAL_CRON` | Không | Đặt `true` để tắt lịch `node-cron` nội bộ |
| `ENABLE_DOCS` | Không | Đặt `true` để bật Swagger tại `/api/docs`; nên tắt ở production nếu không cần công khai |

Khi `NODE_ENV=production`, backend từ chối khởi động nếu thiếu MongoDB URI, CLIENT_URL, JWT secrets, JOBS_SECRET hoặc `COOKIE_SAMESITE`; nếu origin CLIENT_URL không phải HTTPS origin chính xác; nếu JWT/job secret quá ngắn; hoặc nếu `COOKIE_SECURE` không phải `true`/`COOKIE_SAMESITE` không hợp lệ. Không dùng giá trị mẫu trong `.env.example` cho production. Không commit `.env`.

## Deploy production (tham chiếu Atlas + Render)

Frontend và API là các dịch vụ riêng. Có thể chạy hai frontend (độc giả và quản trị) cùng một backend; thêm **cả hai origin chính xác** vào `CLIENT_URL`, phân tách bằng dấu phẩy, không thêm dấu `/` cuối. Đặt origin độc giả đầu tiên vì link đặt lại mật khẩu hiện dùng origin đầu trong danh sách. Ví dụ minh họa:

Tài liệu Render: [Web Services](https://render.com/docs/web-services), [Health Checks](https://render.com/docs/health-checks), [WebSockets](https://render.com/docs/websocket), [Environment Variables](https://render.com/docs/configure-environment-variables).

```env
CLIENT_URL=https://thuvienonline.com,https://quantrithuvien.com
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

Hai domain ví dụ trên là hai site khác nhau. Cookie refresh khi admin frontend gọi API là cookie bên thứ ba; `SameSite=None; Secure` là điều kiện cần nhưng trình duyệt có thể chặn cookie bên thứ ba. URL mặc định của Render (`*.onrender.com`) cũng là các site riêng vì `onrender.com` là public suffix; dùng URL này để smoke test API/Socket trước, không coi là đã xác nhận refresh cookie hoạt động. Phương án ổn định hơn là dùng các subdomain cùng một domain gốc riêng, ví dụ `www.thuvienonline.com`, `admin.thuvienonline.com` và `api.thuvienonline.com`; khi đó cân nhắc `COOKIE_SAMESITE=lax`. Dù dùng cách nào, phải kiểm tra đăng nhập, refresh và đăng xuất ở các trình duyệt mục tiêu.

### 1. Tạo MongoDB Atlas production

1. Tạo project/cluster production ở khu vực gần backend.
2. Tạo database user riêng cho ứng dụng, chỉ cấp quyền `readWrite` trên database `library`; không dùng tài khoản Atlas quản trị.
3. Trong Network Access, cho phép outbound IP của hosting. Chỉ dùng `0.0.0.0/0` nếu nền tảng không cấp IP cố định và bạn chấp nhận giới hạn này; đặt mật khẩu database mạnh.
4. Lấy URI kết nối và chọn database `library`, ví dụ dạng `mongodb+srv://.../library?retryWrites=true&w=majority`. Mã hóa ký tự đặc biệt trong username/password theo yêu cầu của URI.
5. Giữ URI như secret trong hosting; không ghi vào file hoặc commit. Atlas là replica set, cần thiết cho transaction mượn/trả.

### 2. Tạo backend service trên Render

1. Tạo Web Service từ repository backend; đặt root directory là `library-backend` nếu kết nối repo monorepo.
2. Dùng Node.js 20.19 trở lên, Build Command `npm ci`, Start Command `npm start`.
3. Đặt Health Check Path là `/health`.
4. Thêm environment variables trong dashboard của service: `NODE_ENV=production`, `MONGODB_URI`, `CLIENT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JOBS_SECRET`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE` theo kiến trúc domain, Cloudinary và SMTP nếu sử dụng. Đặt `ENABLE_DOCS=false`; nền tảng tự cấp `PORT`.
5. Tạo từng secret độc lập, không dùng secret local. Có thể chạy lệnh sau ba lần ở máy cá nhân và nhập riêng từng kết quả vào dashboard: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
6. Deploy, lấy URL HTTPS của API và kiểm tra `https://<api-domain>/health` trả HTTP 200.

### 3. Tạo admin và cấu hình hai frontend

1. Chạy `npm run create-admin` trong Shell của service (nếu có) sau khi đã cấu hình `MONGODB_URI`; nhập `ADMIN_EMAIL` và `ADMIN_PASSWORD` tạm thời qua secret/environment của lần chạy. Có thể chạy từ máy local đã kết nối Atlas production, nhưng tránh ghi mật khẩu vào lịch sử shell. Gỡ bỏ credential tạm sau khi tạo admin. **Không chạy `npm run seed` production.**
2. Trên frontend độc giả và frontend quản trị, đặt `VITE_API_URL=https://<api-domain>/api/v1` và `VITE_SOCKET_URL=https://<api-domain>`, cùng `withCredentials` cho các request cần refresh cookie; build lại sau khi đổi `VITE_*`.
3. Frontend cần gửi credentials và API phải cho phép đúng hai origin qua `CLIENT_URL`; backend CORS và Socket.IO đọc cùng danh sách origin.
4. Với mỗi frontend Vite (`library-frontend-user/`, `library-frontend-admin/`), cấu hình SPA fallback trên hosting tương ứng để reload route con không trả 404. Source frontend chưa có trong repository hiện tại nên fallback và `withCredentials` phải được xác nhận khi frontend được bổ sung/deploy.

### 4. Kiểm tra sau deploy

1. Mở `/health`; kiểm tra đăng nhập và refresh session ở cả hai frontend, gồm cookie trong DevTools.
2. Mở Socket.IO trên domain thật; trong DevTools → Network xác nhận kết nối polling và nâng cấp WebSocket (nếu nền tảng hỗ trợ).
3. Upload thử ảnh Cloudinary; thực hiện luồng mượn/duyệt thử để xác nhận transaction Atlas hoạt động.
4. Xác nhận `/api/docs` tắt (`ENABLE_DOCS=false`) và gọi job thủ công với header `x-jobs-secret`; không đưa secret vào URL hoặc log.
5. Cấu hình backup Atlas và lịch job bên ngoài nếu hosting có thể sleep; đặt `DISABLE_INTERNAL_CRON=true` khi scheduler ngoài đã thay thế cron nội bộ.

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
