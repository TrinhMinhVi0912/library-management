# Câu hỏi còn mở

| # | Câu hỏi | Trạng thái | Giả định tạm |
|---|---|---|---|
| Q1 | Mongoose hay driver `mongodb` thuần? | Chưa xác nhận | Mongoose |
| Q2 | BE-40: dịch vụ gửi email reset? | ✅ Không áp dụng | Người dùng chọn khôi phục trực tiếp tại quầy, không dùng email; xem D-034 |
| Q3 | Nơi deploy (Render / Railway / VPS / khác)? | ✅ Đã chốt | Render |
| Q4 | Thông báo chung: `notificationReads` hay fan-out từng người? | ✅ Đã chốt | Dùng `notificationReads`; audience chung phát realtime qua Socket.IO rooms |
| Q5 | Có cắt Diễn đàn/Đặt trước nếu thiếu thời gian? | Chưa quyết | Làm cuối (Giai đoạn 6) |
| Q6 | BE-28: admin đặt lại mật khẩu người dùng bằng cách nào? | ✅ Đã thay đổi ở D-034 | Staff/admin cấp mã dùng một lần sau xác minh trực tiếp; chỉ bàn giao trực tiếp |
| Q7 | Xác minh email reset thật | ✅ Không áp dụng | Không gửi email trong quy trình khôi phục mới |
| Q8 | BE-31: các lựa chọn khoảng thời gian cho dashboard charts | ✅ Đã chốt | 7 ngày / 30 ngày / 12 tháng |
| Q9 | BE-38: domain production cho frontend độc giả, frontend quản trị, API | Chưa chọn | Dùng URL mặc định `onrender.com` để smoke test; dùng custom subdomain cùng domain gốc trước production vì onrender.com là public suffix |
| Q10 | FE-20: ngưỡng “sắp đến hạn nhận” trên dashboard là bao nhiêu ngày? | ✅ Đã chốt | 3 ngày tới |
| Q11 | BE-39: xử lý thế nào khi email Google trùng tài khoản đã đăng ký bằng mật khẩu? | ✅ Đã chốt | Không tự liên kết; yêu cầu người dùng đăng nhập bằng email/mật khẩu trước |
| Q12 | BE-39/FE-40: Google OAuth client ID, authorized origins và callback local/production là gì? | Chưa cấu hình – cần trước khi QA deploy | Tạo OAuth client sau khi chốt URL hai frontend; giữ client ID trong env và không commit secrets |
