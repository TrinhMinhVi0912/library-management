---
description: Chuyển sang làm một task cụ thể theo mã, ví dụ /task BE-12
---

# /task <ID> – làm task chỉ định

1. Lấy ID từ lời gọi (ví dụ `BE-12`, `FE-07`). Mở `tasks/INDEX.md`, tìm dòng của ID.
2. Kiểm tra phụ thuộc. Nếu có phụ thuộc chưa `✅` → báo cho người dùng và hỏi có tiếp tục không (không tự ý bỏ qua).
3. Nếu đang có task khác `🟦` chưa xong → hỏi người dùng muốn tạm dừng task đó (ghi lý do vào SESSION.md) hay không.
4. Đặt task này `🟦` trong INDEX.md, cập nhật "Task đang làm" trong `context/SESSION.md`.
5. Thực hiện `/resume` từ bước 2 (mở file task, đọc đúng mục "Đọc", lập kế hoạch, làm).
