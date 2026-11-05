# Frontend quản trị thư viện

Ứng dụng Vue 3 + Vite dành riêng cho nhân viên và quản trị viên. App có package, router, auth state và build riêng; dùng chung API backend với app độc giả.

## Chạy local

Từ thư mục gốc dự án, chạy backend trong terminal thứ nhất:

```powershell
cd library-backend
npm run dev
```

Backend cần phản hồi tại `http://localhost:5000/health`. Cấu hình phát triển trong `library-backend/.env` cần cho phép đúng origin của admin trong `CLIENT_URL` (mặc định `http://localhost:5173`).

Mở terminal thứ hai tại thư mục gốc dự án rồi chạy admin app:

```powershell
cd library-frontend-admin
npm install
Copy-Item .env.example .env
npm run dev
```

Nếu Vite tự chọn cổng khác vì `5173` đang được app khác sử dụng, thêm origin mới (ví dụ `http://localhost:5174`) vào `CLIENT_URL` của backend rồi khởi động lại backend.

Điền URL vào `.env`:

- `VITE_API_URL`: origin backend kèm `/api/v1`.
- `VITE_SOCKET_URL`: origin backend, không kèm path `/api/v1`.
- `VITE_USER_APP_URL`: URL website dành cho độc giả để chuyển hướng người dùng sai app.

Không đặt secret hoặc refresh token trong biến `VITE_*`. Access token chỉ lưu trong Pinia ở bộ nhớ; refresh token là cookie `httpOnly` do backend quản lý.

## Scripts

```powershell
npm run lint
npm run build
npm run preview
```

Các route quản trị yêu cầu staff/admin; cài đặt, nhật ký và quản lý nhân viên yêu cầu admin. Backend vẫn là nơi xác thực quyền cuối cùng.
