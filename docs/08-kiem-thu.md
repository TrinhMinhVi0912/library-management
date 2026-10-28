# 08 – Kế hoạch kiểm thử

## 1. Công cụ
- Backend: Jest + Supertest, MongoDB test riêng (DB `library_test` hoặc `mongodb-memory-server` dạng replica set để thử transaction).
- Frontend: kiểm thử tay theo checklist vai trò; tùy chọn Vitest cho store/service.
- Lệnh: `npm test` (backend). Test **không** dùng DB dev/production.

## 2. Test tự động bắt buộc (backend)

| Nhóm | Ca kiểm thử |
|---|---|
| Auth | Đăng ký trùng email → 409; đăng nhập sai → 401; tài khoản `locked` không đăng nhập; refresh rotate; token hết hạn → 401 |
| Phân quyền | Độc giả gọi `/admin/*` → 403; nhân viên đổi vai trò → 403; độc giả xem phiếu của người khác → 403/404 |
| Mượn | Giỏ > 5 → lỗi; có phạt chưa trả → không gửi được; có sách quá hạn → không gửi được |
| Duyệt | Duyệt trừ `availableCopies`; hết sách → rollback toàn bộ phiếu; **hai yêu cầu duyệt đồng thời** không làm tồn kho âm |
| Giao | `approved → borrowing`, `dueDate = borrowDate + loanDays`, `borrowCount` tăng |
| Trả | Tốt: +1 tồn; Hư hỏng: tạo phạt; Mất: `totalCopies −1` + phạt mất; trả trễ N ngày → phạt `N × lateFeePerDay`; trả một phần giữ phiếu `borrowing/overdue`; trả hết → `returned` |
| Gia hạn | Chưa quá hạn/còn lượt/không đặt trước/không yêu cầu đang chờ mới được gửi; gửi lần 2 khi đang chờ → 409; duyệt → `dueDate +7`, `renewCount +1`, `renewals[]` ghi; duyệt khi vừa có người đặt trước → từ chối; trả sách khi đang chờ → yêu cầu tự `cancelled` |
| Đánh giá | Chưa mượn → 403; đã `borrowing/returned/lost` → tạo được; mỗi độc giả 1 đánh giá/sách (upsert); `ratingAvg` đúng sau sửa/xóa/ẩn |
| Phạt | Phạt trễ tính đúng; `pay` ghi người thu + thời gian; `waive` chỉ admin; `unpaidFineTotal` đồng bộ |
| Thông báo | Mỗi sự kiện nghiệp vụ tạo bản ghi; Socket chỉ emit sau commit; client chưa xác thực bị từ chối kết nối |
| Job | `expirePickup` hoàn tồn kho đúng một lần dù chạy 2 lần; `markOverdue` idempotent |
| Upload | File sai loại/quá 2MB bị từ chối; thay ảnh gọi xóa `publicId` cũ |

## 3. Luồng end-to-end chính (smoke test)
1. Đăng ký độc giả → đăng nhập
2. Thêm 2 sách vào giỏ → gửi yêu cầu mượn
3. Nhân viên (đã đăng nhập ở trình duyệt khác) thấy badge tăng realtime → duyệt
4. Độc giả nhận toast "đã duyệt" → đến nhận → nhân viên xác nhận giao
5. Độc giả gửi yêu cầu gia hạn → nhân viên duyệt → hạn trả đổi
6. Nhân viên xác nhận trả (1 quyển tốt, 1 quyển hư) → hệ thống tạo phạt
7. Độc giả thấy khóa mượn do nợ phạt → nhân viên bấm "đã thu" → mượn được lại
8. Độc giả đánh giá sách đã mượn thành công; đánh giá sách chưa mượn bị chặn

## 4. Checklist chấp nhận theo vai trò

### Khách
- [ ] Xem/tìm/lọc sách, xem chi tiết, đọc diễn đàn
- [ ] Bấm mượn/đặt trước → chuyển đăng nhập rồi quay lại đúng trang
- [ ] Không vào được `/cart`, `/my/*`, `/admin/*`

### Độc giả
- [ ] Giỏ, gửi yêu cầu, hủy phiếu `pending/approved`
- [ ] Yêu cầu gia hạn, nút bị vô hiệu kèm tooltip đúng lý do
- [ ] Lịch sử mượn + `LoanTimeline` đúng bước; phạt hiển thị đúng
- [ ] Thông báo realtime (chuông, toast); mở lại trang số chưa đọc đồng bộ
- [ ] Kệ sách, đánh giá (chỉ sách đã mượn), hồ sơ, đổi mật khẩu, đổi ảnh đại diện

### Nhân viên
- [ ] Dashboard, hàng đợi cần xử lý, badge realtime
- [ ] Duyệt/từ chối yêu cầu mượn (lý do), giao, trả, ghi/thu phạt
- [ ] Duyệt/từ chối gia hạn (lý do)
- [ ] CRUD sách/danh mục, tải ảnh bìa; kiểm duyệt diễn đàn
- [ ] Khóa/mở **độc giả**; không đổi vai trò, không thấy Cài đặt/Nhật ký

### Admin
- [ ] Tất cả quyền nhân viên + quản lý nhân viên, đổi vai trò, miễn phạt, cài đặt chính sách, nhật ký, xuất Excel

## 5. Kiểm tra bảo mật
- [ ] Không trả `passwordHash`/token trong bất kỳ phản hồi nào
- [ ] Thử NoSQL injection (`{"$gt":""}` trong login/query) bị chặn
- [ ] Thử XSS trong bài diễn đàn/đánh giá không thực thi
- [ ] Rate-limit hoạt động ở `/auth/*` và đăng bài
- [ ] CORS chỉ cho origin cấu hình
- [ ] Token hết hạn → socket bị ngắt, client kết nối lại bằng token mới
- [ ] `API_SECRET` Cloudinary không xuất hiện trong bundle frontend
- [ ] Độc giả không sửa được `rating` của người khác, không đổi `role` qua `PATCH /me`

## 6. Mẫu báo lỗi
```
Tiêu đề: <ngắn gọn>
Bước tái hiện: 1… 2… 3…
Kết quả thực tế / mong đợi:
Vai trò + môi trường (local/prod), trình duyệt:
Log/ảnh chụp:
Tham chiếu tài liệu: (vd 01 §7.3)
```
