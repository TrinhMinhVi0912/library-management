---
description: Chọn task kế tiếp từ tasks/INDEX.md rồi bắt đầu làm
---

# /next – chọn và bắt đầu task kế tiếp

1. Đọc `tasks/INDEX.md`. Nếu có task đang `🟦` (đang làm) → dùng task đó, bỏ qua bước 2.
2. Chọn task `⬜` đầu tiên có **mọi phụ thuộc đã `✅`** theo thứ tự trong `tasks/INDEX.md`. Thứ tự mặc định: hết Backend (BE) rồi đến Frontend (FE). Trong track Frontend, ưu tiên hoàn thành nhóm admin (`FE-19…FE-31`, `FE-34`) trước nhóm user (`FE-01…FE-18`, `FE-32`, `FE-33`, `FE-35`), rồi mới làm task chung (`FE-36…FE-38`), trừ khi người dùng yêu cầu khác.
3. Đổi trạng thái task đó trong INDEX.md thành `🟦`.
4. Ghi vào `context/SESSION.md` mục "Task đang làm" (chỉ sửa mục đó, giữ phần còn lại).
5. Thực hiện các bước của `/resume` từ bước 2 trở đi (mở file task, đọc đúng mục "Đọc", báo cáo kế hoạch, bắt đầu làm).
