# Câu hỏi còn mở

| # | Câu hỏi | Trạng thái | Giả định tạm |
|---|---|---|---|
| Q1 | Mongoose hay driver `mongodb` thuần? | Chưa xác nhận | Mongoose |
| Q2 | Dịch vụ gửi email (Gmail SMTP / Brevo / Resend)? | Chưa chọn | Làm sau, ẩn "quên mật khẩu" nếu chưa cấu hình |
| Q3 | Nơi deploy (Render / Railway / VPS / khác)? | ✅ Đã chốt | Render |
| Q4 | Thông báo chung: `notificationReads` hay fan-out từng người? | ✅ Đã chốt | Dùng `notificationReads`; audience chung phát realtime qua Socket.IO rooms |
| Q5 | Có cắt Diễn đàn/Đặt trước nếu thiếu thời gian? | Chưa quyết | Làm cuối (Giai đoạn 6) |
| Q6 | BE-28: admin đặt lại mật khẩu người dùng bằng cách nào (đặt mật khẩu mới trực tiếp, tạo mật khẩu tạm, hay gửi link qua luồng email hiện có)? | ✅ Đã chốt | Gửi link qua luồng email hiện có; endpoint admin gọi service quên mật khẩu |
| Q7 | Xác minh giao email reset thật tới hòm thư thử nghiệm | Để sau | Cấu hình SMTP hợp lệ trong `library-backend/.env`, rồi chạy kiểm tra gửi một lần; hiện mailer chỉ giả lập |
| Q8 | BE-31: các lựa chọn khoảng thời gian cho dashboard charts | ✅ Đã chốt | 7 ngày / 30 ngày / 12 tháng |
| Q9 | BE-38: domain production cho frontend độc giả, frontend quản trị, API | Chưa chọn | Dùng URL mặc định `onrender.com` để smoke test; dùng custom subdomain cùng domain gốc trước production vì onrender.com là public suffix |
| Q10 | FE-20: ngưỡng “sắp đến hạn nhận” trên dashboard là bao nhiêu ngày? | ✅ Đã chốt | 3 ngày tới |
