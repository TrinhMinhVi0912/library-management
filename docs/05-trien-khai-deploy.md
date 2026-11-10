# 05 – Triển khai (Deploy) & Cấu hình môi trường

Mục tiêu: **code một lần, chạy được ở local và internet chỉ bằng cách đổi biến môi trường**. Không hard-code URL, khóa, origin trong code.

## 1. Kiến trúc triển khai

```
Trình duyệt ──► Frontend (static: Vite build)  ──► Backend (Express + Socket.IO) ──► MongoDB (local replica set / Atlas)
                                                          └──────────────────────► Cloudinary
```
- Có ba ứng dụng deploy độc lập: frontend user (`library-frontend-user/`), frontend admin (`library-frontend-admin/`) và backend (`library-backend/`). Hai frontend build thành hai static site/domain riêng, cùng gọi một API và Socket.IO backend.
- Dữ liệu: dùng MongoDB local replica set khi demo trên máy; dùng MongoDB Atlas khi public. Hai môi trường chỉ khác `MONGODB_URI`, backend giữ nguyên transaction.
- Ảnh: Cloudinary (backend không lưu file lên đĩa).

## 2. Gợi ý nền tảng (chọn một, đều hợp lệ)

| Thành phần | Lựa chọn dễ | Ghi chú |
|---|---|---|
| Frontend user + admin | Vercel / Netlify / Cloudflare Pages | Tạo 2 static site; mỗi site build từ đúng thư mục, output `dist`, cấu hình SPA fallback riêng |
| Backend | Render / Railway / Fly.io / VPS (PM2 + Nginx) | Cần hỗ trợ WebSocket; bản free có thể "ngủ" → xem mục 7 |
| Database | MongoDB Atlas (M0 free) | Có replica set → dùng được transaction |

## 3. Biến môi trường

### 3.1 Backend (`library-backend/.env`)
Xem mẫu đầy đủ ở file 04 mục 7. Quy tắc:

| Biến | Local | Production |
|---|---|---|
| `NODE_ENV` | development | production |
| `PORT` | 5000 | do nền tảng cấp (đọc `process.env.PORT`) |
| `MONGODB_URI` | `mongodb://localhost:27017/library?replicaSet=rs0&retryWrites=true&w=majority` | MongoDB Atlas SRV URI from Render Environment |
| `CLIENT_URL` | `http://localhost:5173` | URL frontend thật (nhiều origin: ngăn cách bằng dấu phẩy) |
| `GOOGLE_CLIENT_ID` | Web OAuth Client ID của Google (tùy chọn) | Cùng Web OAuth Client ID đã khai báo authorized origins của hai frontend; cần đặt để bật `POST /api/v1/auth/google` |
| `COOKIE_SECURE` | false | true |
| `COOKIE_SAMESITE` | lax | `none` nếu frontend và API khác site; `lax` nếu các subdomain cùng domain gốc |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | chuỗi bất kỳ | chuỗi ngẫu nhiên dài ≥ 32 ký tự, **khác** local |
| `CLOUDINARY_*` | tài khoản dev | tài khoản production |
| `JOBS_SECRET` | tùy ý | chuỗi ngẫu nhiên |

### 3.2 Cả hai frontend (`library-frontend-user/.env`, `library-frontend-admin/.env`)

Mỗi app có file `.env` và environment variables riêng; giá trị API/Socket giống nhau nhưng không chia sẻ build artifact:
```
VITE_API_URL=https://api.example.com/api/v1
VITE_SOCKET_URL=https://api.example.com
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
```

`VITE_GOOGLE_CLIENT_ID` chỉ cần cho user frontend; dùng cùng Web OAuth Client ID với `GOOGLE_CLIENT_ID` trên backend và thêm origin của user frontend vào Authorized JavaScript origins trong Google Cloud Console. Với local, origin thường là `http://localhost:5173`; trên production dùng origin HTTPS chính xác. Sau khi đổi env cần build lại frontend. Không đặt client secret ở frontend.
Lưu ý: biến `VITE_*` được **nhúng vào bundle lúc build**. Đổi giá trị thì phải build lại. Tuyệt đối không đặt bí mật (secret) vào biến `VITE_*`.

Có thể deploy frontend độc giả và frontend quản trị thành hai dịch vụ, dùng chung một backend. Khi đó `CLIENT_URL` gồm đủ hai origin (không có dấu `/` cuối); đặt origin độc giả đầu tiên vì link đặt lại mật khẩu dùng origin đầu tiên. Nếu dùng hai domain gốc khác nhau như `thuvienonline.com` và `quantrithuvien.com`, admin phải gọi refresh cookie cross-site; đặt `COOKIE_SAMESITE=none` và `COOKIE_SECURE=true`, đồng thời kiểm thử trên trình duyệt mục tiêu vì chính sách chặn third-party cookie có thể ảnh hưởng đăng nhập. Các URL mặc định `*.onrender.com` cũng là site riêng do `onrender.com` thuộc Public Suffix List; chỉ dùng chúng cho smoke test ban đầu. Cấu hình ổn định hơn là đặt cả hai frontend và API trên các subdomain của một domain gốc riêng.

## 4. Chuẩn bị trước khi deploy

### 4.1 MongoDB Atlas
1. Tạo cluster, tạo user database riêng cho ứng dụng (quyền `readWrite` trên DB `library`).
2. Network Access: thêm IP của backend; nếu hosting không có IP cố định thì tạm cho `0.0.0.0/0` và dựa vào user/mật khẩu mạnh.
3. Lấy connection string `mongodb+srv://...` cho `MONGODB_URI`.

### 4.2 Cloudinary
Lấy `cloud_name`, `api_key`, `api_secret` ở Dashboard. Thư mục lưu: `library/books`, `library/avatars`, `library/authors`.

### 4.3 Khôi phục mật khẩu
Không cần cấu hình nhà cung cấp email. Độc giả cần xác minh trực tiếp tại quầy; staff/admin cấp mã dùng một lần trong trang quản trị và bàn giao trực tiếp cho độc giả.

## 5. Điều chỉnh code bắt buộc để chạy sau proxy

Thực hiện trong `app.js` / `server.js`:

1. `app.set('trust proxy', 1)` — để `req.ip`, cookie `secure` và `express-rate-limit` hoạt động đúng phía sau reverse proxy của hosting.
2. CORS: `origin` lấy từ `CLIENT_URL` (tách bằng dấu phẩy), `credentials: true`.
3. Cookie refresh token: `httpOnly: true`, `secure`/`sameSite` đọc từ config (mục 3.1).
4. Frontend `axios`: `withCredentials: true` để gửi cookie refresh.
5. Socket.IO: `cors: { origin: CLIENT_URL list, credentials: true }`; client dùng `VITE_SOCKET_URL`; để mặc định transport (polling rồi nâng cấp websocket) để chạy được ở nền tảng chặn WebSocket thuần.
6. `GET /health` trả 200 (xem file 04 mục 3.6).
7. Lắng nghe `0.0.0.0` và `process.env.PORT`.
8. Swagger `/api/docs`: tắt ở production hoặc bảo vệ bằng biến `ENABLE_DOCS`.
9. Tắt log chi tiết (`morgan` dùng định dạng `combined`), không log token/mật khẩu.

## 6. Các bước deploy

### 6.1 Backend (ví dụ Render/Railway)
1. Đẩy repo `library-backend` lên GitHub.
2. Tạo Web Service: Build `npm install`, Start `npm start`.
3. Khai báo toàn bộ biến môi trường ở mục 3.1.
4. Sau khi chạy: mở `/health` kiểm tra.
5. Tạo admin đầu tiên: chạy `npm run create-admin` (qua Shell của nền tảng hoặc chạy ở máy local với `MONGODB_URI` production). **Không** chạy `seed` trên production thật.

### 6.2 Frontend (ví dụ Vercel/Netlify)
1. Tạo **hai static site** trên hosting, mỗi site trỏ vào một repo/ứng dụng `library-frontend-user` và `library-frontend-admin` (hoặc cùng monorepo nhưng cấu hình root directory tương ứng).
2. Cho từng site chạy Build Command `npm ci && npm run build`, output `dist`.
3. Khai báo `VITE_API_URL`, `VITE_SOCKET_URL` cho cả hai site ở phần Environment; build lại mỗi site sau khi đổi biến.
4. Cấu hình SPA fallback độc lập trong cả hai app:
   - Netlify: file `public/_redirects` với dòng `/*  /index.html  200`.
   - Vercel: `vercel.json` với rewrite mọi đường dẫn về `/index.html`.
5. Sau khi có cả hai URL, cập nhật backend `CLIENT_URL` thành hai origin đầy đủ, phân tách bằng dấu phẩy (không có dấu `/` cuối), user đứng trước; rồi redeploy backend.

#### Cấu hình cụ thể cho Vercel (monorepo)

Tạo **hai Vercel Project** cùng import repository GitHub này; mỗi project đặt Root Directory riêng. Hai file `vercel.json` đã có trong từng thư mục để reload/deep link của Vue Router history mode trả về `index.html`.

| Thiết lập | Project độc giả | Project quản trị |
|---|---|---|
| Root Directory | `library-frontend-user` | `library-frontend-admin` |
| Framework Preset | Vite | Vite |
| Install Command | `npm ci` (hoặc để Vercel tự nhận diện npm) | `npm ci` (hoặc để Vercel tự nhận diện npm) |
| Build Command | `npm run build` | `npm run build` |
| Output Directory | `dist` | `dist` |
| Environment variables | `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID` | `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_USER_APP_URL` |

Trong Vercel, cấu hình biến ở **Production** và **Preview** nếu cần; giá trị Vite được nhúng lúc build nên sau khi sửa biến phải redeploy. Giá trị production:

```dotenv
VITE_API_URL=https://<backend-render>.onrender.com/api/v1
VITE_SOCKET_URL=https://<backend-render>.onrender.com
```

Project độc giả đặt thêm `VITE_GOOGLE_CLIENT_ID` bằng Google OAuth **Client ID công khai** (không phải client secret). Project quản trị đặt `VITE_USER_APP_URL` thành URL production của frontend độc giả để các liên kết “đăng nhập độc giả” và trang không quyền chuyển đúng nơi. Sau deploy, thêm origin HTTPS thật của frontend độc giả vào Authorized JavaScript origins trong Google Cloud Console.

Sau khi Vercel cấp hai URL, thêm chính xác cả hai origin vào backend `CLIENT_URL` (không có path hoặc dấu `/` cuối). Vì backend Render và các URL `*.vercel.app` khác site, cấu hình cookie refresh cross-site theo phần 3.1 và thử đăng nhập rồi tải lại trang. Nếu các URL deployment preview thay đổi theo từng nhánh, không đưa tất cả preview origin vào `CLIENT_URL`; dùng domain production cố định để kiểm tra phiên đăng nhập.

### 6.3 VPS (tùy chọn)
- Node 20 LTS + PM2 (`pm2 start server.js --name library-api`).
- Nginx reverse proxy tới cổng backend, bật nâng cấp WebSocket (`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).
- HTTPS bằng Let's Encrypt (certbot).

## 7. Cron job khi hosting "ngủ"

`node-cron` chỉ chạy khi tiến trình đang sống. Nếu dùng gói free tự ngủ:
- Gọi `POST /api/v1/system/jobs/:name` (hoặc `/jobs/:name`) kèm header `x-jobs-secret: <JOBS_SECRET>` bằng cron-job.org hoặc GitHub Actions theo lịch ở file 04 mục 5.
- Mỗi job phải **idempotent** (chạy lặp lại không gây hại).
- Nếu có biến `DISABLE_INTERNAL_CRON=true` thì `server.js` không đăng ký `node-cron` (tránh chạy trùng khi dùng lịch ngoài).

## 8. Checklist deploy

- [ ] `.env` không bị commit; `.env.example` đầy đủ và cập nhật
- [ ] Secret production khác secret local
- [ ] CORS/`CLIENT_URL` đúng, đăng nhập giữ được phiên (cookie hoạt động)
- [ ] Socket.IO kết nối thành công trên domain thật (kiểm tra tab Network → WS)
- [ ] Upload ảnh bìa lên Cloudinary thành công
- [ ] Transaction chạy được (Atlas) — thử duyệt một phiếu mượn
- [ ] `create-admin` đã chạy, đăng nhập được `/admin`
- [ ] Reload trang con của SPA không bị 404
- [ ] `/health` trả 200; `/api/docs` đã tắt hoặc bị bảo vệ
- [ ] Lịch chạy job đã thiết lập (nội bộ hoặc bên ngoài)
- [ ] Sao lưu: bật backup Atlas hoặc `mongodump` định kỳ

## 9. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Đăng nhập xong F5 bị văng | Cookie refresh không được lưu (khác domain) | `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `withCredentials`, HTTPS cả hai phía |
| Lỗi CORS | `CLIENT_URL` sai/thiếu, có dấu `/` cuối | Khớp chính xác origin, không có `/` cuối |
| Socket không kết nối | Sai `VITE_SOCKET_URL`, proxy chặn WS, token hết hạn | Kiểm tra URL, cấu hình proxy, kết nối lại sau refresh |
| `Transaction numbers are only allowed on a replica set` | Chạy MongoDB local đơn lẻ | Dùng Atlas hoặc docker-compose replica set một node |
| Trang con 404 khi reload | Thiếu SPA fallback | Thêm `_redirects`/`vercel.json` |
| Gọi API ra `localhost` trên production | Quên đặt `VITE_API_URL` rồi build lại | Đặt biến và build lại |
| Rate-limit chặn tất cả người dùng | Thiếu `trust proxy` nên mọi request cùng IP proxy | `app.set('trust proxy', 1)` |

## 10. Chạy local với replica set (nếu không dùng Atlas)

Yêu cầu Docker Desktop đang chạy. Trong thư mục gốc dự án có `docker-compose.yml` để chạy MongoDB một node dạng replica set. Khởi động dịch vụ bằng:

```powershell
docker compose up -d mongo
```

Trong `library-backend/.env`, đặt:

```dotenv
MONGODB_URI=mongodb://localhost:27017/library?replicaSet=rs0&retryWrites=true&w=majority
```

Khởi động backend sau khi container `mongo` chuyển sang trạng thái healthy. Dữ liệu được giữ trong Docker volume `library_mongo_data` qua các lần dừng/chạy container.

Khi public trên Render, đặt `MONGODB_URI` thành connection string Atlas trong phần Environment của dịch vụ backend. Atlas đã hỗ trợ replica set; không thêm `replicaSet=rs0` vào URI Atlas. Không đưa URI có mật khẩu vào Git hoặc tài liệu.
