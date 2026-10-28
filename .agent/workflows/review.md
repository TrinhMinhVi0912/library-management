---
description: Rà soát thay đổi hiện tại theo nghiệp vụ, kiến trúc, bảo mật (chỉ nhận xét, không sửa)
---

# /review – rà soát (chỉ đọc)

1. Xác định phạm vi: người dùng nêu; nếu không, dùng `git diff` + `git diff --staged` và task đang `🟦`.
2. Đối chiếu theo checklist (đọc đúng mục tài liệu liên quan, không đọc thừa):
   - **Nghiệp vụ**: khớp `context/digest.md` §D1, D3, D6 (điều kiện gia hạn, điều kiện đánh giá, khóa mượn, công thức phạt, vòng đời trạng thái).
   - **Kiến trúc**: controller mỏng; nghiệp vụ ở service; thông báo chỉ qua `notify.service`; view không gọi axios trực tiếp.
   - **Dữ liệu**: transaction đúng chỗ, có `{ session }`, emit sau commit; tồn kho cập nhật có điều kiện; index; phân trang; không N+1.
   - **Bảo mật**: validate input, kiểm tra role/quyền sở hữu, không lộ `passwordHash`/token, sanitize nội dung diễn đàn, không hard-code khóa/URL.
   - **Chất lượng**: lint, không `console.log` thừa, xử lý lỗi, 3 trạng thái UI, mobile, `aria-label`.
   - **Tài liệu**: đã cập nhật nếu đổi hành vi; `.env.example` đủ biến.
3. Kết quả theo mức: **Chặn merge / Nên sửa / Gợi ý**; mỗi mục: file:dòng, vấn đề, cách sửa. Kết luận cuối: duyệt hay cần sửa. **Không tự sửa code.**
