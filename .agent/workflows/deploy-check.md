---
description: Kiểm tra mức sẵn sàng deploy theo docs/05
---

# /deploy-check

1. Đọc `docs/05-trien-khai-deploy.md` mục 5, 8, 9 (không đọc cả file nếu không cần).
2. Rà mã nguồn bằng `grep` có mục tiêu: `localhost`, `http://`, khóa/secret hard-code; `.env` nằm trong `.gitignore`; `.env.example` đủ biến so với `app/config/index.js` và `import.meta.env`.
3. Kiểm tra: `trust proxy`, CORS theo `CLIENT_URL`, cookie `secure/sameSite` đọc từ config, `GET /health`, `POST /jobs/:name`, SPA fallback (`_redirects`/`vercel.json`), Socket.IO CORS.
4. Trả bảng: mục – Đạt/Chưa – ghi chú/cách sửa. Không tự đổi cấu hình production, không in giá trị biến môi trường thật.
