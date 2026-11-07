# SESSION – bàn giao giữa các cuộc trò chuyện

## Task vừa làm
- ID: FE-03 – API service, auth store khung, UI store.
- Trạng thái: ✅ Code/lint/build hoàn tất; API/CORS browser QA còn chờ người dùng.

## Đã làm
- Axios dùng `VITE_API_URL`, `withCredentials`, bearer token; refresh promise dùng chung cho request 401 đồng thời; lỗi API toast, hỗ trợ `silent`.
- Auth store có login/logout/fetchMe/refresh; access token chỉ nằm trong Pinia memory. UI store có loading và sidebar.
- Kiểm tra: `npm run lint` đạt; `npm run build` đạt. Build có Sass deprecation warnings từ Bootstrap.

## File chính
- `library-frontend-user/src/services/api.service.js`
- `library-frontend-user/src/stores/auth.store.js`, `src/stores/ui.store.js`, `src/main.js`, `src/router/index.js`
- `tasks/frontend/FE-03.md`, `tasks/frontend/qa/FE-03.md`, `tasks/INDEX.md`

## Còn chờ
- Chưa gọi API/CORS từ browser; checklist tại `tasks/frontend/qa/FE-03.md` gồm cách thử `GET /books?limit=1`.
- Thay đổi FE-34 admin trước đó vẫn còn trong worktree; chưa tạo git commit.

## Bước tiếp theo
- Chờ người dùng xác nhận commit; sau đó bắt đầu FE-04: component dùng chung (1/2) cho user app.
