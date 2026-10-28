---
description: Tiếp tục công việc ở cuộc trò chuyện mới, chỉ nạp ngữ cảnh tối thiểu (tiết kiệm token)
---

# /resume – nạp lại ngữ cảnh tối thiểu

Mục tiêu: vào việc ngay với ít token nhất. **Không đọc toàn bộ `docs/`.**

1. Đọc `context/SESSION.md` (file bàn giao, ngắn). Lấy: task đang làm, trạng thái, đã làm, đang dở, bước tiếp theo, blocker, file đã chạm.
2. Mở đúng file task đang làm: `tasks/backend/BE-xx.md` hoặc `tasks/frontend/FE-xx.md`.
   - Nếu SESSION.md ghi "không có task đang làm" → chuyển sang `/next`.
3. Chỉ đọc các mục trong phần **Đọc** của task: ưu tiên `context/digest.md` (đúng mục `§Dx`), rồi mới đến `docs/*` (đúng mục, dùng `grep -n '^#'` để tìm dòng rồi đọc khoảng cần thiết).
4. Kiểm tra thực tế bằng lệnh nhỏ, không đọc lan man:
   - `git status -s` (nếu là repo git) để thấy thay đổi chưa commit.
   - `ls`/`grep` có mục tiêu để xác nhận các file nêu ở "Đã làm"/"Đang dở" thật sự tồn tại và còn đúng.
   - Nếu SESSION.md và thực tế lệch nhau → tin thực tế, sửa SESSION.md ở lần `/done` tới.
5. Báo cáo tối đa ~8 dòng: task + mục tiêu, đã có gì, còn thiếu gì, kế hoạch các bước (đánh số), điểm cần hỏi (nếu có).
6. Nếu không có điểm chặn → tiếp tục thực hiện task theo kế hoạch ngay. Nếu có điểm mơ hồ về nghiệp vụ → hỏi trước, ghi `context/open-questions.md`.
7. Làm đúng phạm vi task. Khi đạt phần **Xong khi** → chạy `/done`.
