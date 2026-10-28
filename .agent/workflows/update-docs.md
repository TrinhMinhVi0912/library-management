---
description: Đồng bộ tài liệu và digest sau khi đổi yêu cầu hoặc code
---

# /update-docs <mô tả thay đổi>

1. Mở `context/traceability.md`, xác định các file bị ảnh hưởng.
2. Sửa tối thiểu từng file trong `docs/` (01, 02, 03, 04, 05) giữ nguyên văn phong; cập nhật bảng/sơ đồ liên quan.
3. **Cập nhật `context/digest.md`** đúng mục tương ứng (digest phải luôn khớp docs).
4. Nếu thay đổi ảnh hưởng task chưa làm → sửa file task tương ứng; nếu cần task mới → thêm vào `tasks/INDEX.md` và tạo file task (theo mẫu các task hiện có).
5. Thêm dòng vào `context/decisions.md` (mã mới, quyết định, lý do).
6. Báo lại ngắn: danh sách file đã sửa và tóm tắt từng thay đổi.
