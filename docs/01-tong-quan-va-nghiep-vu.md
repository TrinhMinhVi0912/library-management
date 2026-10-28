# 01 – Tổng quan & Luồng nghiệp vụ: Website Quản lý Mượn Sách

## 1. Mục tiêu
Xây dựng website thư viện cho phép độc giả tìm sách, đăng ký mượn online, theo dõi mượn/trả/phạt; nhân viên xử lý nghiệp vụ tại quầy; có diễn đàn để cộng đồng trao đổi về sách.

## 1.1 Các quyết định đã chốt (phiên bản 2)

| Vấn đề | Quyết định |
|---|---|
| Gia hạn | Độc giả **gửi yêu cầu gia hạn**; nhân viên/admin **duyệt hoặc từ chối** (có lý do) |
| Đánh giá | **Chỉ độc giả đã mượn sách đó** (đã nhận sách) mới được đánh giá |
| Thông báo | **Socket.IO** (thời gian thực) + lưu DB để xem lại |
| Ảnh bìa | Lưu trên **Cloudinary** (DB chỉ lưu `url` + `publicId`) |
| Thanh toán phạt | **Tại quầy**; nhân viên bấm xác nhận đã thu, không có thanh toán online |
| Giao dịch DB | Dùng **MongoDB transaction** (MongoDB Atlas có sẵn replica set) |
| Triển khai | Phát triển local, **deploy internet dễ dàng** nhờ cấu hình hoàn toàn bằng biến môi trường (file 05) |
| Cấu trúc thư mục | Đơn giản, mở rộng từ cấu trúc mẫu Express + Vue đang dùng (file 04) |

## 2. Công nghệ

| Tầng | Công nghệ chính | Thư viện bổ trợ |
|---|---|---|
| Frontend | Vue 3 (Vite) + Bootstrap 5 | vue-router, pinia, axios, **socket.io-client**, bootstrap-icons, chart.js + vue-chartjs, vee-validate + yup, vue-toastification, dayjs, sweetalert2 |
| Backend | Node.js + Express.js | mongoose, jsonwebtoken, bcryptjs, joi, **socket.io**, **cloudinary**, multer (memoryStorage), cors, helmet, express-rate-limit, express-mongo-sanitize, morgan, node-cron, dotenv, nodemailer, swagger-ui-express, exceljs (xuất báo cáo) |
| Database | MongoDB | Mongoose ODM; MongoDB Atlas (cả dev lẫn production) hoặc local replica set |
| Lưu trữ ảnh | Cloudinary | Upload từ backend, trả về `url` + `publicId` |

## 3. Vai trò & phân quyền

| Chức năng | Khách | Độc giả | Nhân viên | Admin |
|---|:-:|:-:|:-:|:-:|
| Xem / tìm kiếm / xem chi tiết sách | ✅ | ✅ | ✅ | ✅ |
| Đăng ký, đăng nhập, quên mật khẩu | ✅ | – | – | – |
| Đọc diễn đàn | ✅ | ✅ | ✅ | ✅ |
| Đăng bài / bình luận diễn đàn | ❌ | ✅ | ✅ | ✅ |
| Giỏ mượn, gửi yêu cầu mượn | ❌ | ✅ | ❌ | ❌ |
| Xem lịch sử mượn, gửi yêu cầu gia hạn | ❌ | ✅ | ❌ | ❌ |
| Quản lý đánh giá của tôi | ❌ | ✅ | ❌ | ❌ |
| Kệ sách của tôi, profile, thông báo | ❌ | ✅ | ✅ (profile, thông báo) | ✅ |
| Dashboard thống kê | ❌ | ❌ | ✅ | ✅ |
| Duyệt yêu cầu mượn, duyệt gia hạn, xác nhận giao/trả, ghi nhận phạt, xác nhận thu phạt | ❌ | ❌ | ✅ | ✅ |
| Quản lý sách, NXB, tác giả, thể loại | ❌ | ❌ | ✅ | ✅ |
| Quản lý thông báo | ❌ | ❌ | ✅ | ✅ |
| Kiểm duyệt diễn đàn (ghim, khóa, xóa) | ❌ | ❌ | ✅ | ✅ |
| Quản lý người dùng (khóa/mở, đổi vai trò) | ❌ | ❌ | ✅ (chỉ độc giả) | ✅ (tất cả) |
| Cấu hình chính sách thư viện, nhật ký hệ thống | ❌ | ❌ | ❌ | ✅ |

## 4. Chức năng bổ sung đề xuất (để hoàn thiện nghiệp vụ)

1. **Thể loại & Tác giả** là thực thể riêng → lọc/tìm kiếm tốt hơn.
2. **Đặt trước sách (Reservation)**: khi sách hết, độc giả đăng ký hàng chờ; có sách trả về thì được thông báo.
3. **Chính sách mượn cấu hình được** (số sách tối đa, số ngày mượn, số lần gia hạn, mức phạt) → Admin chỉnh trong trang Cài đặt.
4. **Hạn nhận sách**: sau khi được duyệt, độc giả phải đến lấy trong N ngày, quá hạn hệ thống tự hủy và trả lại tồn kho.
5. **Job tự động (node-cron)**: nhắc sắp đến hạn, đánh dấu quá hạn, tính phạt, hủy yêu cầu hết hạn nhận.
6. **Khóa mượn** khi độc giả có phạt chưa thanh toán hoặc đang có sách quá hạn.
7. **Quên mật khẩu / đổi mật khẩu**.
8. **Nhật ký hoạt động (audit log)** cho thao tác nhân viên/admin.
9. **Xuất báo cáo Excel** (mượn/trả, phạt).
10. **Báo cáo vi phạm** bài/bình luận diễn đàn.
11. **Thông báo thời gian thực bằng Socket.IO** (đã chốt): chuông, toast và số đếm yêu cầu chờ duyệt cập nhật ngay, không cần tải lại trang.
12. **Yêu cầu gia hạn có duyệt**: độc giả gửi yêu cầu, nhân viên duyệt/từ chối kèm lý do.
13. **Hàng đợi xử lý của nhân viên**: gom yêu cầu mượn + yêu cầu gia hạn + sách sắp hết hạn nhận trên Dashboard.

## 5. Quy tắc nghiệp vụ (mặc định, chỉnh trong `settings`)

| Quy tắc | Giá trị mặc định |
|---|---|
| Số sách tối đa đang mượn cùng lúc / mỗi yêu cầu | 5 |
| Số ngày mượn | 14 |
| Gia hạn tối đa | 2 lần × 7 ngày, **mỗi lần phải được nhân viên duyệt** |
| Điều kiện gửi yêu cầu gia hạn | Chưa quá hạn, không có người đặt trước, chưa vượt số lần, không có yêu cầu gia hạn đang chờ cho cùng quyển |
| Hạn đến nhận sách sau khi duyệt | 3 ngày |
| Phạt trả trễ | 2.000đ / ngày / quyển |
| Phạt hư hỏng | 30–100% đơn giá (nhân viên nhập) |
| Phạt mất sách | 100% đơn giá + phí xử lý (mặc định 20.000đ) |
| Mỗi độc giả | 1 đánh giá / 1 sách; **bắt buộc đã nhận sách đó** (phiếu có quyển ở trạng thái `borrowing`/`returned`/`lost`) |
| Thanh toán phạt | Tại quầy, nhân viên xác nhận đã thu; không thanh toán online |

## 6. Vòng đời trạng thái

### 6.1 Phiếu mượn (`loans`)
```
pending ──duyệt──► approved ──giao sách──► borrowing ──trả hết──► returned
   │                  │                        │
   │ từ chối          │ quá hạn nhận /          │ quá hạn trả
   ▼                  │ độc giả hủy             ▼
rejected              ▼                      overdue ──trả──► returned (có phạt)
                  cancelled / expired
```
- Trạng thái ở **cấp phiếu**; mỗi `items[]` có trạng thái riêng (`borrowing | returned | lost`) vì có thể trả từng quyển.
- Phiếu `returned` khi mọi item đã `returned` hoặc `lost`.

### 6.2 Phạt (`fines`)
`unpaid` → `paid` (hoặc `waived` – miễn, kèm lý do, chỉ admin).

### 6.3 Đặt trước (`reservations`)
`waiting` → `available` (có sách, giữ 3 ngày) → `fulfilled` / `expired` / `cancelled`.

### 6.4 Yêu cầu gia hạn (`renewalRequests`)
`pending` → `approved` (hạn trả được cộng thêm) / `rejected` (kèm lý do) / `cancelled` (độc giả tự hủy, hoặc tự hủy khi quyển đã được trả).

## 7. Luồng nghiệp vụ chi tiết

### 7.1 Đăng ký / đăng nhập
1. Khách điền form đăng ký (họ, tên, email, mật khẩu, ngày sinh, giới tính, địa chỉ, SĐT) → tạo `users` role `reader`, mã độc giả tự sinh (`DG000123`).
2. Đăng nhập → nhận access token (15 phút, lưu memory/pinia) + refresh token (httpOnly cookie, 7 ngày).
3. Nhân viên/admin dùng cùng form đăng nhập; hệ thống điều hướng theo role (`/admin` hoặc trang chủ).
4. Tài khoản `locked` không đăng nhập được.

### 7.2 Mượn sách (end-to-end)
1. Độc giả xem chi tiết sách → **Thêm vào giỏ mượn** (kiểm tra: còn sách, chưa có trong giỏ, giỏ < 5).
2. Vào **Giỏ mượn** → chọn ngày dự kiến đến lấy → **Gửi yêu cầu**.
   - Server kiểm tra: tài khoản không bị khóa, không nợ phạt, không có sách quá hạn, tổng đang mượn + yêu cầu ≤ 5.
   - Tạo `loans` status `pending`; xóa giỏ; gửi thông báo cho nhân viên.
3. Nhân viên mở **Duyệt yêu cầu**:
   - **Duyệt**: kiểm tra lại tồn kho → `availableCopies -= 1` cho từng sách (transaction) → status `approved`, đặt `pickupDeadline` → thông báo độc giả.
   - **Từ chối**: nhập lý do → status `rejected` → thông báo.
4. Độc giả đến thư viện. Nhân viên mở phiếu `approved` → **Xác nhận giao sách** → status `borrowing`, `borrowDate = now`, `dueDate = now + 14 ngày` cho từng item → thông báo.
5. Quá `pickupDeadline` mà chưa nhận → cron chuyển `expired`, hoàn tồn kho, thông báo (và phục vụ hàng chờ đặt trước nếu có).

### 7.3 Gia hạn (có nhân viên duyệt)
1. Độc giả vào **Lịch sử mượn** → chọn quyển đang mượn → **Yêu cầu gia hạn** (có thể ghi lý do).
2. Server kiểm tra điều kiện ở mục 5 (chưa quá hạn, còn lượt, không có đặt trước, không có yêu cầu đang chờ) → tạo `renewalRequests` `pending`; nhân viên nhận thông báo realtime và số đếm trên sidebar tăng.
3. Nhân viên mở **Duyệt gia hạn**:
   - **Duyệt**: kiểm tra lại điều kiện (lúc này có thể đã có người đặt trước) → `dueDate += 7`, `renewCount += 1`, ghi `renewals[]` → thông báo độc giả.
   - **Từ chối**: nhập lý do → thông báo độc giả.
4. Độc giả có thể **hủy yêu cầu** khi còn `pending`. Nếu quyển được trả trong lúc đang chờ → yêu cầu tự hủy.

### 7.4 Trả sách
1. Nhân viên tìm phiếu (theo mã phiếu / mã độc giả) → chọn các quyển trả → với mỗi quyển chọn tình trạng: **Tốt / Hư hỏng / Mất**.
2. Xác nhận:
   - Tốt: `availableCopies += 1`, item `returned`.
   - Hư hỏng: `availableCopies += 1` (hoặc không, tùy chọn "đưa vào kho sửa") + tạo phạt hư hỏng.
   - Mất: không tăng tồn; `totalCopies -= 1`; tạo phạt mất sách.
   - Nếu `returnDate > dueDate` → tự động tạo phạt trễ hạn = số ngày × mức phạt.
3. Nếu còn quyển khác trong phiếu đang mượn → phiếu giữ `borrowing`/`overdue`; nếu hết → `returned`.
4. Tự hủy yêu cầu gia hạn đang chờ (nếu có) của quyển vừa trả. Thông báo độc giả (kèm phạt nếu có). Nếu sách có hàng chờ đặt trước → chuyển người đầu hàng chờ sang `available` + thông báo.

### 7.4b Ghi nhận phạt
- Phạt tự động từ trả trễ; nhân viên có thể **ghi nhận phạt thủ công** (hư hỏng, mất, vi phạm khác) với lý do + số tiền.
- Khi độc giả nộp tiền tại quầy → nhân viên bấm **Xác nhận đã thu tiền** → `paid` (ghi nhân viên thu + thời gian). Hệ thống không có thanh toán online.
- Tổng nợ phạt > 0 ⇒ khóa mượn mới.

### 7.5 Đặt trước
1. Sách `availableCopies = 0` → nút **Đặt trước** thay cho **Thêm vào giỏ**.
2. Khi có bản trả về → người đầu hàng chờ nhận thông báo, được giữ sách 3 ngày (có thể thêm vào giỏ & gửi yêu cầu ưu tiên); quá hạn → chuyển người kế.

### 7.6 Đánh giá
- Chỉ độc giả **đã nhận sách đó** mới được đánh giá; chưa mượn thì form đánh giá được thay bằng gợi ý "Mượn sách để đánh giá" và API trả 403.
- Độc giả chấm 1–5 sao + nhận xét; sửa/xóa đánh giá của mình ở **Đánh giá của tôi**.
- `books.ratingAvg`, `ratingCount` cập nhật mỗi khi thay đổi.
- Nhân viên có thể ẩn đánh giá vi phạm.

### 7.7 Kệ sách của tôi
- Mặc định 3 kệ: *Muốn đọc*, *Đang đọc*, *Đã đọc*; tạo thêm kệ tùy ý.
- Thêm/xóa/chuyển sách giữa các kệ ngay từ trang chi tiết sách.

### 7.8 Thông báo
- Nguồn: hệ thống (duyệt, từ chối, duyệt/từ chối gia hạn, sắp hạn, quá hạn, phạt, đặt trước), nhân viên/admin (thông báo chung hoặc gửi riêng), diễn đàn (có người trả lời bài của bạn).
- Chuông trên navbar hiển thị số chưa đọc; trang **Thông báo** có lọc & đánh dấu đã đọc.
- **Thời gian thực bằng Socket.IO**: server lưu thông báo vào DB rồi đẩy tới phòng riêng của người nhận; client hiện toast và tăng số trên chuông ngay. Khi mất kết nối/mở lại trang, client gọi API lấy số chưa đọc để đồng bộ.
- Nhân viên/admin còn nhận số đếm realtime: yêu cầu mượn chờ duyệt, yêu cầu gia hạn chờ duyệt.

### 7.9 Diễn đàn
- Thành viên tạo **chủ đề (thread)** trong một **chuyên mục**, có thể gắn với một cuốn sách; người khác **trả lời (post)**, thích, báo cáo.
- Hỗ trợ trả lời lồng 1 cấp (`parentId`).
- Nhân viên/admin: ghim, khóa, xóa, xử lý báo cáo.
- Chống spam: rate-limit, giới hạn độ dài, tài khoản bị khóa không đăng được.

### 7.10 Dashboard (nhân viên/admin)
- Thẻ số liệu: tổng sách, độc giả, đang mượn, quá hạn, yêu cầu mượn chờ duyệt, yêu cầu gia hạn chờ duyệt, phạt chưa thu.
- Biểu đồ: lượt mượn theo ngày/tháng; top sách mượn nhiều; phân bố theo thể loại; doanh thu phạt.
- Danh sách cần xử lý: yêu cầu mượn và gia hạn chờ duyệt, sách sắp/quá hạn, sách sắp hết.

## 8. Lộ trình triển khai đề xuất

| Giai đoạn | Nội dung |
|---|---|
| 1 | Khởi tạo dự án, kết nối DB, auth (JWT + role), seed dữ liệu |
| 2 | CRUD sách / NXB / tác giả / thể loại (ảnh bìa lên Cloudinary); trang khách (danh sách, tìm kiếm, chi tiết) |
| 3 | Giỏ mượn → yêu cầu → duyệt → giao → trả → phạt |
| 4 | Yêu cầu gia hạn + duyệt, lịch sử, thông báo realtime (Socket.IO), kệ sách, đánh giá (chỉ người đã mượn), profile |
| 5 | Dashboard, quản lý người dùng, cài đặt, cron jobs |
| 6 | Diễn đàn, đặt trước |
| 7 | Kiểm thử, tối ưu giao diện, tài liệu, **deploy** (xem file 05) |
