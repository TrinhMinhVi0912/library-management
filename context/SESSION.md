# SESSION – bàn giao giữa các cuộc trò chuyện

## Task vừa làm
- ID: FE-05 – Layout công khai, navbar, footer, router khung (user app).
- Trạng thái: ✅ Code, lint và build xong; browser QA chờ người dùng.

## Đã làm
- Thêm PublicLayout, AppNavbar, AppFooter, PlaceholderPage, NotFound và Forbidden.
- Router khai báo route public/reader, guard role + safe redirect, guest routes và dev preview.
- `auth.restoreSession()` chia sẻ refresh đang chạy; layout phục hồi nền và guard chờ phiên khi cần.
- Lint/build đạt; build còn Sass deprecation warnings của Bootstrap.

## File chính
- `library-frontend-user/src/{layouts/PublicLayout.vue,components/common/AppNavbar.vue,components/common/AppFooter.vue,router/index.js,stores/auth.store.js}`
- `tasks/frontend/FE-05.md`, `tasks/frontend/qa/FE-05.md`, `tasks/INDEX.md`

## Còn chờ
- Người dùng kiểm tra layout, routes, vai trò theo checklist QA; xác minh F5 sau FE-06.

## Bước tiếp theo
- Chờ người dùng xác nhận commit; sau đó làm FE-06: đăng nhập, đăng ký, quên/đặt lại mật khẩu.
- Ghi nhớ: AppNavbar nhận `cartCount`/`unreadCount`; tìm kiếm chuyển `q` + `scope` sang `/books`.
