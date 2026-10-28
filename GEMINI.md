# GEMINI.md – Ghi chú riêng cho Antigravity

Đọc `AGENTS.md` (quy tắc chung). Bổ sung:

- Ưu tiên chế độ **Planning** cho task có transaction/Socket/phân quyền (BE-18, BE-20, BE-22, BE-25, BE-35); dùng **Fast** cho task giao diện đơn giản.
- Mở Agent Manager/Editor ở **thư mục gốc dự án** để thấy cả hai repo; bật *Load nested AGENTS.md files* trong Settings để agent đọc thêm `library-backend/AGENTS.md`, `library-frontend/AGENTS.md`.
- Chạy lệnh terminal ở đúng thư mục repo (`cd library-backend` hoặc `cd library-frontend`).
- Đừng đọc cả thư mục `docs/`; làm theo `/resume`. Khi cuộc trò chuyện đã dài (≥ ~2 task hoặc ngữ cảnh nặng), chạy `/done` và đề nghị người dùng mở cuộc trò chuyện mới.
- Không dùng trình duyệt tự động trừ khi task yêu cầu kiểm thử giao diện.
