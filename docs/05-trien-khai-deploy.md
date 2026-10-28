# 05 – Triển khai (Deploy) & Cấu hình môi trường

Mục tiêu: **code một lần, chạy được ở local và internet chỉ bằng cách đổi biến môi trường**. Không hard-code URL, khóa, origin trong code.

## 1. Kiến trúc triển khai

```
Trình duyệt ──► Frontend (static: Vite build)  ──► Backend (Express + Socket.IO) ──► MongoDB Atlas
                                                          └──────────────────────► Cloudinary
                                                          └──────────────────────► SMTP (email)
```
- Frontend và backend là **hai dịch vụ riêng**, deploy độc lập.
- Dữ liệu: MongoDB Atlas (dùng cho cả dev lẫn production, chỉ khác cluster/DB).
- Ảnh: Cloudinary (backend không lưu file lên đĩa).

## 2. Gợi ý nền tảng (chọn một, đều hợp lệ)

| Thành phần | Lựa chọn dễ | Ghi chú |
|---|---|---|
| Frontend | Vercel / Netlify / Cloudflare Pages | Build `npm run build`, thư mục `dist`, cần SPA fallback |
| Backend | Render / Railway / Fly.io / VPS (PM2 + Nginx) | Cần hỗ trợ WebSocket; bản free có thể "ngủ" → xem mục 7 |
| Database | MongoDB Atlas (M0 free) | Có replica set → dùng được transaction |

## 3. Biến môi trường

### 3.1 Backend (`library-backend/.env`)
Xem mẫu đầy đủ ở file 04 mục 7. Quy tắc:

| Biến | Local | Production |
|---|---|---|
| `NODE_ENV` | development | production |
| `PORT` | 5000 | do nền tảng cấp (đọc `process.env.PORT`) |
| `MONGODB_URI` | cluster dev | cluster production |
| `CLIENT_URL` | `http://localhost:5173` | URL frontend thật (nhiều origin: ngăn cách bằng dấu phẩy) |
| `COOKIE_SECURE` | false | true |
| `COOKIE_SAMESITE` | lax | `none` nếu frontend và backend **khác domain**, `lax` nếu cùng site |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | chuỗi bất kỳ | chuỗi ngẫu nhiên dài ≥ 32 ký tự, **khác** local |
| `CLOUDINARY_*` | tài khoản dev | tài khoản production |
| `JOBS_SECRET` | tùy ý | chuỗi ngẫu nhiên |

### 3.2 Frontend (`library-frontend/.env`)
```
VITE_API_URL=https://api.example.com/api/v1
VITE_SOCKET_URL=https://api.example.com
```
Lưu ý: biến `VITE_*` được **nhúng vào bundle lúc build**. Đổi giá trị thì phải build lại. Tuyệt đối không đặt bí mật (secret) vào biến `VITE_*`.

## 4. Chuẩn bị trước khi deploy

### 4.1 MongoDB Atlas
1. Tạo cluster, tạo user database riêng cho ứng dụng (quyền `readWrite` trên DB `library`).
2. Network Access: thêm IP của backend; nếu hosting không có IP cố định thì tạm cho `0.0.0.0/0` và dựa vào user/mật khẩu mạnh.
3. Lấy connection string `mongodb+srv://...` cho `MONGODB_URI`.

### 4.2 Cloudinary
Lấy `cloud_name`, `api_key`, `api_secret` ở Dashboard. Thư mục lưu: `library/books`, `library/avatars`, `library/authors`.

### 4.3 Email (tùy chọn)
Gmail SMTP với App Password, hoặc Brevo / Resend. Chưa cần thì để trống và ẩn chức năng quên mật khẩu.

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
1. Đẩy repo `library-frontend` lên GitHub.
2. Build `npm run build`, output `dist`.
3. Khai báo `VITE_API_URL`, `VITE_SOCKET_URL` ở phần Environment của nền tảng.
4. SPA fallback:
   - Netlify: file `public/_redirects` với dòng `/*  /index.html  200`.
   - Vercel: `vercel.json` với rewrite mọi đường dẫn về `/index.html`.
5. Cập nhật `CLIENT_URL` ở backend thành URL frontend vừa có, rồi redeploy backend.

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

`docker-compose.yml` mẫu (đặt ở thư mục gốc dự án, tùy chọn):
```yaml
services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports: ["27017:27017"]
    healthcheck:
      test: >
        mongosh --quiet --eval "try{rs.status().ok}catch(e){rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]}).ok}"
      interval: 5s
      retries: 10
```
`MONGODB_URI=mongodb://localhost:27017/library?replicaSet=rs0`
