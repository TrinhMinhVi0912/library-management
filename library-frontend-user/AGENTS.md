# AGENTS.md – library-frontend-user

Frontend độc lập cho khách và độc giả; deploy thành static site riêng. Dùng chung API backend với `library-frontend-admin/`, nhưng không chứa màn hình quản trị.

- Quy tắc chung: `../AGENTS.md` và `../.agent/rules/20-frontend.md`; API contract: `../docs/09-tai-lieu-api-frontend.md`; UI: `../docs/03-thiet-ke-giao-dien.md`; tóm tắt: `../context/digest.md`.
- Stack: Vue 3 + Vite, Bootstrap 5 + SCSS, vue-router, Pinia, Axios, Socket.IO client và thư viện đã chốt trong docs/01.
- Chứa các màn hình public/auth, reader, catalog, reviews, shelves, reservations, notifications và forum người dùng.
- `VITE_API_URL` trỏ tới API có hậu tố `/api/v1`; `VITE_SOCKET_URL` trỏ tới origin API. Không đặt secret trong `VITE_*`.
- Mọi API qua `src/services/*`; view không gọi Axios trực tiếp. Dùng Bearer access token; refresh cookie cần `withCredentials: true`.
- Access token ở memory/Pinia, không đưa refresh token vào localStorage. Router chỉ bảo vệ quyền UI; backend vẫn là nguồn kiểm tra quyền.
- Mỗi trang cần trạng thái loading, empty, error; tiếng Việt trong giao diện.
- Chạy tại repo này: `npm run dev`, `npm run build`, `npm run lint`.
