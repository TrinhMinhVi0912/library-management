# SESSION – bàn giao giữa các cuộc trò chuyện

## Task vừa xử lý
- FE-41 – Bài đăng diễn đàn của tôi: thêm API danh sách/chi tiết chỉ theo chủ sở hữu, trang `/forum/my`, phân trang, sửa và ẩn bài từ trang này; cập nhật task, API docs, digest, decisions và QA checklist. Lint frontend/file backend thay đổi và build user app pass; browser QA còn chờ checklist.
- Chuẩn bị Vercel cho FE-38: thêm `vercel.json` SPA fallback và hướng dẫn Root Directory/build/env riêng trong README hai app và docs deploy. Cả hai production build thành công; chưa tạo/deploy Vercel project.

## Task đang làm / bước tiếp theo
- Người dùng kiểm tra giao diện FE-41 theo checklist `tasks/frontend/qa/FE-41.md`; nếu phát sinh lỗi thì sửa trước khi đánh dấu task ✅.
- Khi đủ điều kiện FE-38, tạo hai Vercel project với root `library-frontend-user` và `library-frontend-admin`, nhập biến production, cập nhật `CLIENT_URL` backend và thử đăng nhập/refresh trên domain thật.
- BE-40 – đã nối API/UI cho mã khôi phục trực tiếp; test suite đang chờ người dùng chạy trước khi đánh dấu hoàn tất.
- FE-37 browser QA theo role và smoke test mượn trả vẫn cần hoàn tất trước FE-38 deploy; checklist tại `tasks/frontend/qa/FE-37.md`. Production Google origin/smoke test làm trong FE-38 sau khi có domain user.

## Ngữ cảnh/giới hạn
- Hai frontend user/admin deploy riêng, dùng chung backend. Trả lời/comment/UI bằng tiếng Việt; không commit nếu chưa được yêu cầu.
- About dùng giờ đã xác nhận: Thứ Hai–Thứ Bảy, 07:00–21:00. Không có API settings công khai.
- Google Login chỉ cấp role reader; nếu email đã thuộc tài khoản mật khẩu thì không tự liên kết, người dùng cần đăng nhập mật khẩu trước (D-033).
- Khôi phục mật khẩu không dùng email/SMTP; quy trình mới được chốt ở D-034.
