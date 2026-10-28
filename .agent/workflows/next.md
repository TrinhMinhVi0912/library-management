---
description: Chọn task kế tiếp từ tasks/INDEX.md rồi bắt đầu làm
---

# /next – chọn và bắt đầu task kế tiếp

1. Đọc `tasks/INDEX.md`. Nếu có task đang `🟦` (đang làm) → dùng task đó, bỏ qua bước 2.
2. Chọn task `⬜` đầu tiên có **mọi phụ thuộc đã `✅`**. Thứ tự: hết track Backend (BE) rồi mới sang Frontend (FE), trừ khi người dùng yêu cầu khác (ví dụ làm FE song song với BE đã xong phần liên quan).
3. Đổi trạng thái task đó trong INDEX.md thành `🟦`.
4. Ghi vào `context/SESSION.md` mục "Task đang làm" (chỉ sửa mục đó, giữ phần còn lại).
5. Thực hiện các bước của `/resume` từ bước 2 trở đi (mở file task, đọc đúng mục "Đọc", báo cáo kế hoạch, bắt đầu làm).
