# Git & bảo mật (luôn bật)

- Nhánh: `main`, `develop`, `feature/<ten-ngan>`, `fix/<ten-ngan>`. Commit theo Conventional Commits (vd `feat(loan): duyệt phiếu mượn`). Chỉ **đề xuất** nội dung commit; không tự commit/push nếu chưa được yêu cầu.
- Không đọc, in, hoặc dán nội dung `.env` hay khóa thật vào trò chuyện/file commit; chỉ cập nhật `.env.example`.
- Không chạy lệnh phá hủy (`rm -rf`, drop database, xóa collection) khi chưa hỏi người dùng. Không chạy `npm run seed` trên DB production.
- Không gọi dịch vụ ngoài (Cloudinary, SMTP) bằng khóa của người khác; dùng biến môi trường.
- Khi cần cài thư viện: nêu tên + lý do, cài đúng phiên bản ổn định, không dùng `@latest` bừa bãi trong package.json.
