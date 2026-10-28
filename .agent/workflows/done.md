---
description: Kết thúc task/phiên - kiểm tra, cập nhật INDEX và SESSION.md để /resume ở chat mới
---

# /done – chốt task và bàn giao

1. **Kiểm tra Definition of Done** của task (phần "Xong khi") và `docs/07` mục 5. Chạy lệnh phù hợp:
   - Backend: `npm run lint`, `npm test` (nếu task có test), kiểm tra tay endpoint.
   - Frontend: `npm run lint`, `npm run build`, kiểm tra tay các trạng thái giao diện.
   Báo rõ mục nào đạt/chưa đạt. Không đánh dấu hoàn thành nếu lint/build lỗi.
2. **Task file**: tick các ô đã đạt trong `tasks/.../ID.md`; thêm mục "Ghi chú" nếu có điều quan trọng cho task sau (ví dụ tên hàm/đường dẫn đã chốt).
3. **INDEX.md**: đổi trạng thái `🟦 → ✅` (hoặc giữ `🟦` nếu chưa xong, kèm ghi chú ngắn ở cột Ghi chú).
4. **Ghi đè `context/SESSION.md`** theo đúng mẫu trong file đó (≤ 40 dòng, không tích lũy lịch sử dài):
   - Task vừa xong / đang dở, trạng thái.
   - Đã làm (ngắn), file chính đã tạo/sửa, lệnh kiểm tra đã chạy.
   - Đang dở / bước tiếp theo (cụ thể, có thể làm ngay).
   - Quyết định mới, điểm cần hỏi, blocker.
   - Task kế tiếp đề xuất (theo INDEX).
5. Nếu có quyết định mới → thêm dòng vào `context/decisions.md`; câu hỏi chưa chốt → `context/open-questions.md`; nếu đổi nghiệp vụ/API/DB → chạy `/update-docs`.
6. Đề xuất nội dung commit (Conventional Commits) và nhánh; **không tự commit** nếu chưa được yêu cầu.
7. Kết thúc bằng đúng một câu: "Đã lưu bàn giao. Mở cuộc trò chuyện mới và gõ `/resume` để tiếp tục (task kế: <ID>)."
