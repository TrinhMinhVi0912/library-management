# AGENTS.md – library-frontend-admin

Frontend độc lập cho nhân viên và quản trị viên; deploy thành static site riêng, dùng chung API backend với `library-frontend-user/`. Không chứa luồng catalog công khai/độc giả ngoài những thành phần xem trước cần cho quản trị.

- Quy tắc chung: `../AGENTS.md` và `../.agent/rules/20-frontend.md`; API contract: `../docs/09-tai-lieu-api-frontend.md`; UI: `../docs/03-thiet-ke-giao-dien.md`; tóm tắt: `../context/digest.md`.
- Stack: Vue 3 + Vite, Bootstrap 5 + SCSS, vue-router, Pinia, Axios, Socket.IO client và thư viện đã chốt trong docs/01.
- Chứa đăng nhập quản trị, dashboard, quản lý mượn/trả/gia hạn/phạt, sách/danh mục, người dùng, thông báo, audit/settings và kiểm duyệt forum.
- `VITE_API_URL` trỏ tới API có hậu tố `/api/v1`; `VITE_SOCKET_URL` trỏ tới origin API. Không đặt secret trong `VITE_*`.
- Mọi API qua `src/services/*`; view không gọi Axios trực tiếp. Dùng Bearer access token; refresh cookie cần `withCredentials: true`.
- Access token ở memory/Pinia. Router có thể yêu cầu `staff|admin`; riêng trang settings/audit và hành động admin-only cần `admin`. Backend vẫn là nơi thực thi quyền cuối cùng.
- Mỗi trang cần trạng thái loading, empty, error; tiếng Việt trong giao diện.
- Chạy tại repo này: `npm run dev`, `npm run build`, `npm run lint`.
