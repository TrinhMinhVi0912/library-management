# Giao thức ngữ cảnh & tiết kiệm token (luôn bật)

1. **Không** đọc toàn bộ `docs/`. Đọc theo thứ tự: `context/SESSION.md` → task hiện tại → `context/digest.md` (đúng mục) → `docs/*` (đúng mục task chỉ định, dùng `grep -n '^#'` rồi đọc khoảng dòng).
2. Không dán lại nội dung tài liệu vào câu trả lời; chỉ nêu tham chiếu (vd "digest §D6").
3. Không liệt kê/đọc lại cả cây thư mục lớn; dùng `grep`/`find` có mục tiêu. Bỏ qua `node_modules`, `dist`, lockfile.
4. Mỗi cuộc trò chuyện = một task. Task xong → chạy `/done` (ghi SESSION.md + INDEX.md) rồi nhắc người dùng mở cuộc trò chuyện mới và gõ `/resume`.
5. Trả lời ngắn: file đã sửa, cách kiểm tra, giả định, việc tiếp theo. Không nhắc lại đề bài.
6. Nếu ngữ cảnh cuộc trò chuyện đã dài hoặc agent bắt đầu quên quy ước: dừng, chạy `/done`, đề nghị cuộc trò chuyện mới.
7. Gặp điều chưa rõ về nghiệp vụ: ghi `context/open-questions.md` và hỏi, không tự quyết.
