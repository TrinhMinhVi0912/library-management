# Ghi chú kiểm thử giao diện theo task

Thư mục này lưu checklist kiểm thử trên trình duyệt cho từng task frontend. Mục tiêu là để việc code tiếp tục nhanh; các bước cần người dùng hoặc người kiểm thử thao tác được ghi lại để chạy sau.

## Quy ước

- Mỗi task có một file `FE-<ID>.md`, ví dụ `FE-19.md`.
- Khi hoàn tất hoặc bàn giao task, cập nhật file QA cùng task: thêm các luồng và trạng thái UI có rủi ro hoặc cần xác nhận bằng trình duyệt.
- Mỗi mục ghi rõ tiền điều kiện, bước kiểm tra và kết quả mong đợi; nêu URL, role, cấu hình hoặc dữ liệu mẫu cần thiết.
- Trạng thái dùng: `Chờ test`, `Đạt`, `Lỗi`, `Bỏ qua`.
- Chỉ ghi `Đạt` khi đã quan sát kết quả trên giao diện. Nếu chưa chạy test tay, để `Chờ test`; không coi đó là blocker để tiếp tục code task khác.
- Khi người dùng gửi kết quả, cập nhật trạng thái và ghi ngắn gọn kết quả/lỗi. Nếu có lỗi, tạo mục việc sửa trong task phù hợp.
- Đây là checklist kiểm thử tay, không thay thế test tự động, lint hoặc build theo yêu cầu của task.

## Mẫu cho task mới

```md
# FE-XX – <Tên task> – Kiểm thử giao diện

## Setup
- App/URL:
- Backend/API:
- Tài khoản/role và dữ liệu mẫu:

## Checklist
| Trạng thái | Luồng | Các bước | Kết quả mong đợi | Kết quả thực tế / ghi chú |
|---|---|---|---|---|
| Chờ test | ... | 1. ... | ... | |
```
