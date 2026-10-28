# 03 – Thiết kế Giao diện & Danh sách trang

Tham khảo bố cục của **Open Library** nhưng đơn giản hơn: nền trắng, nhiều khoảng trống, chữ rõ, thao tác chính luôn thấy ngay.

## 1. Nguyên tắc thiết kế
1. **Nền trắng**, vùng phụ dùng xám rất nhạt (`#f8f9fa`), viền mảnh `#e5e7eb`.
2. **Một màu nhấn** (xanh dương) cho nút chính, liên kết, trạng thái đang chọn.
3. **Ưu tiên tìm kiếm**: thanh tìm kiếm luôn nằm giữa navbar.
4. **Mỗi trang một hành động chính** (nút to, màu đặc); hành động phụ dùng nút viền.
5. **Trạng thái rõ ràng bằng badge màu** (cùng bảng màu ở mọi nơi).
6. **Responsive**: mobile-first với lưới Bootstrap; bảng quản trị cuộn ngang / chuyển dạng thẻ trên mobile.
7. **Phản hồi tức thì**: toast cho thành công/lỗi, skeleton khi tải, trạng thái rỗng có hướng dẫn, hộp xác nhận cho thao tác nguy hiểm.
8. Bàn phím & truy cập: focus rõ, `aria-label` cho icon, độ tương phản ≥ 4.5:1.

## 2. Design tokens

| Thành phần | Giá trị |
|---|---|
| Primary | `#2563eb` (hover `#1d4ed8`) |
| Success / Warning / Danger / Info | `#16a34a` / `#f59e0b` / `#dc2626` / `#0ea5e9` |
| Text chính / phụ | `#111827` / `#6b7280` |
| Nền / nền phụ / viền | `#ffffff` / `#f8f9fa` / `#e5e7eb` |
| Font | Inter hoặc system-ui; cỡ chữ gốc 16px |
| Bo góc | 8px (thẻ), 999px (badge/pill) |
| Đổ bóng | rất nhẹ, chỉ khi hover thẻ sách |
| Icon | Bootstrap Icons |

Ghi đè biến Bootstrap bằng SCSS (`$primary`, `$border-radius`, `$font-family-base`).

**Màu trạng thái (badge)**

| Trạng thái | Màu | Nhãn |
|---|---|---|
| pending | vàng | Chờ duyệt |
| approved | xanh dương nhạt | Chờ nhận sách |
| borrowing | xanh dương | Đang mượn |
| overdue | đỏ | Quá hạn |
| returned | xanh lá | Đã trả |
| rejected / cancelled / expired | xám/đỏ nhạt | Từ chối / Đã hủy / Hết hạn |
| Sách còn / hết | xanh lá / xám đỏ | Còn X quyển / Hết sách |

## 3. Bố cục chung

### 3.1 Layout công khai (khách + độc giả)
```
┌───────────────────────────────────────────────────────────────┐
│ Logo | Danh mục ▾ | [ Tìm sách… ▾(Tất cả/Tên/Tác giả) 🔍 ] |  │
│ Diễn đàn | 🛒Giỏ(2) 🔔(3) | Avatar ▾ / Đăng nhập – Đăng ký    │
├───────────────────────────────────────────────────────────────┤
│                       <router-view>                           │
├───────────────────────────────────────────────────────────────┤
│ Footer: giới thiệu, giờ mở cửa, liên hệ, liên kết nhanh       │
└───────────────────────────────────────────────────────────────┘
```
- Menu avatar: Hồ sơ, Lịch sử mượn, Kệ sách của tôi, Đánh giá của tôi, Thông báo, Đăng xuất.
- Mobile: navbar thu gọn (hamburger), thanh tìm kiếm xuống hàng dưới.

### 3.2 Layout quản trị (nhân viên/admin)
```
┌──────────┬────────────────────────────────────────────────────┐
│ Sidebar  │ Topbar: tiêu đề trang | 🔔 | avatar ▾               │
│ Dashboard├────────────────────────────────────────────────────┤
│ Yêu cầu  │ Nội dung (breadcrumb, bộ lọc, bảng, form)           │
│ Mượn/Trả │                                                     │
│ Sách …   │                                                     │
└──────────┴────────────────────────────────────────────────────┘
```
- Sidebar thu gọn được; trên mobile là offcanvas.
- Mục chỉ admin (Cài đặt, Nhật ký, Quản lý nhân viên) ẩn với nhân viên.
- Mục **Duyệt yêu cầu** và **Duyệt gia hạn** có badge đỏ hiển thị số đang chờ, cập nhật realtime qua Socket.IO.

## 4. Danh sách trang & mô tả

### 4.1 Khách (public)

| Route | Trang | Nội dung & thao tác |
|---|---|---|
| `/` | Trang chủ | Banner tìm kiếm lớn; các hàng cuộn ngang: **Sách mới**, **Mượn nhiều**, **Đánh giá cao**; lưới **Thể loại**; khối **Chủ đề diễn đàn nổi bật**; thông báo chung của thư viện |
| `/books` | Danh sách / tìm kiếm | Cột trái **bộ lọc** (thể loại, tác giả, NXB, năm, chỉ còn sách, điểm đánh giá); phía trên: ô tìm, sắp xếp (liên quan, mới, phổ biến, A–Z), chuyển lưới/danh sách; thẻ sách phân trang; chip bộ lọc đang chọn có nút xóa |
| `/books/:slug` | Chi tiết sách | Trái: ảnh bìa lớn. Giữa: tên, tác giả (link), NXB, năm, ISBN, thể loại (chip), số trang, vị trí kệ, mô tả (thu gọn/mở rộng). Phải: **hộp mượn** – trạng thái còn/hết, nút **Thêm vào giỏ mượn** (hoặc **Đặt trước** nếu hết), **Thêm vào kệ ▾**. Dưới: tab **Đánh giá** (điểm TB, phân bố sao, danh sách; form đánh giá chỉ hiện với người đã mượn sách này, người khác thấy gợi ý "Mượn sách để đánh giá"), **Thảo luận** (chủ đề diễn đàn liên quan), **Sách tương tự**. Khách bấm nút mượn → chuyển đến đăng nhập rồi quay lại |
| `/authors/:id` | Tác giả | Giới thiệu + sách của tác giả |
| `/login` | Đăng nhập | Email, mật khẩu, ghi nhớ, link quên mật khẩu/đăng ký |
| `/register` | Đăng ký | Họ lót, tên, email, mật khẩu (+ chỉ báo độ mạnh), ngày sinh, giới tính, địa chỉ, SĐT |
| `/forgot-password`, `/reset-password/:token` | Quên mật khẩu | Gửi email đặt lại |
| `/forum` | Diễn đàn | Xem mục 4.4 |
| `/about` | Giới thiệu / nội quy | Giờ mở cửa, chính sách mượn, mức phạt |
| `/404` | Không tìm thấy | Gợi ý về trang chủ |

### 4.2 Độc giả (đăng nhập)

| Route | Trang | Nội dung & thao tác |
|---|---|---|
| `/cart` | Giỏ mượn | Danh sách sách (ảnh, tên, trạng thái còn/hết), nút xóa; chọn ngày dự kiến đến nhận; ghi chú; bảng tóm tắt (số quyển, hạn trả dự kiến, chính sách); nút **Gửi yêu cầu mượn**; cảnh báo nếu bị khóa/nợ phạt |
| `/my/loans` | Lịch sử mượn | Tab: *Chờ duyệt · Chờ nhận · Đang mượn · Quá hạn · Đã trả · Khác*. Mỗi phiếu là thẻ mở rộng được, liệt kê sách + hạn trả còn bao nhiêu ngày + nút **Yêu cầu gia hạn** (sau khi gửi hiện trạng thái *Chờ duyệt / Đã duyệt / Bị từ chối* và lý do nếu bị từ chối); phiếu chờ duyệt có **Hủy yêu cầu**; hiển thị phạt liên quan |
| `/my/fines` | Phạt của tôi | Bảng phạt, tổng nợ, trạng thái; (không thanh toán online – trả tại quầy) |
| `/my/shelves` | Kệ sách của tôi | Tab các kệ (Muốn đọc / Đang đọc / Đã đọc / kệ tùy tạo); lưới sách; menu chuyển kệ/xóa; tạo-đổi tên-xóa kệ |
| `/my/reviews` | Quản lý đánh giá | Danh sách đánh giá của tôi (sách, sao, nội dung, ngày); sửa tại chỗ, xóa |
| `/my/reservations` | Sách đặt trước | Danh sách hàng chờ, vị trí trong hàng, hủy |
| `/notifications` | Thông báo | Danh sách có lọc (Tất cả/Chưa đọc/loại), đánh dấu đã đọc/đọc tất cả, bấm vào chuyển tới nội dung liên quan; dropdown chuông hiển thị 5 mới nhất |
| `/profile` | Hồ sơ | Tab *Thông tin cá nhân* (sửa, đổi ảnh), *Đổi mật khẩu* |

### 4.3 Nhân viên / Admin (`/admin/...`)

| Route | Trang | Nội dung & thao tác |
|---|---|---|
| `/admin` | Dashboard | 6 thẻ số liệu; biểu đồ đường lượt mượn 30 ngày; cột top 10 sách; tròn theo thể loại; bảng "Cần xử lý hôm nay" (yêu cầu mượn chờ duyệt, yêu cầu gia hạn chờ duyệt, sắp đến hạn nhận, quá hạn); chọn khoảng thời gian; xuất Excel |
| `/admin/requests` | Duyệt yêu cầu mượn | Bảng phiếu `pending` (mã, độc giả, số sách, ngày gửi); mở panel chi tiết: thông tin độc giả (nợ phạt, đang mượn), tồn kho từng sách; nút **Duyệt** / **Từ chối** (nhập lý do), duyệt hàng loạt |
| `/admin/handover` | Xác nhận giao sách | Phiếu `approved`; tìm theo mã phiếu/mã độc giả; nút **Xác nhận đã giao**; hiển thị hạn nhận, cảnh báo sắp hết hạn |
| `/admin/returns` | Xác nhận trả sách | Tìm phiếu đang mượn/quá hạn; tick quyển trả, chọn tình trạng (Tốt/Hư hỏng/Mất); xem trước tiền phạt tự tính (có thể sửa); **Xác nhận trả** |
| `/admin/renewals` | Duyệt gia hạn | Bảng yêu cầu gia hạn `pending`: độc giả, sách, hạn hiện tại → hạn đề xuất, số lần đã gia hạn, cảnh báo nếu có người đặt trước; nút **Duyệt** / **Từ chối** (nhập lý do), duyệt hàng loạt |
| `/admin/loans` | Tất cả phiếu mượn | Bảng có lọc trạng thái/ngày/độc giả; xem chi tiết; in phiếu |
| `/admin/fines` | Ghi nhận phạt | Bảng phạt; **Thêm phạt thủ công**; **Xác nhận đã thu tiền tại quầy**; miễn phạt (admin); tổng chưa thu |
| `/admin/books` | Quản lý sách | Bảng + tìm/lọc; form thêm/sửa (ảnh bìa tải lên **Cloudinary**, có xem trước, thể loại nhiều lựa chọn, tác giả chọn/thêm nhanh, tồn kho); ẩn/hiện; xóa (chỉ khi chưa có lịch sử mượn) |
| `/admin/catalog` | Danh mục | Tab **NXB · Tác giả · Thể loại** (CRUD gọn trong modal) |
| `/admin/users` | Quản lý người dùng | Bảng độc giả/nhân viên; lọc vai trò/trạng thái; xem chi tiết (lịch sử mượn, phạt); khóa/mở khóa (kèm lý do); đặt lại mật khẩu; thêm nhân viên, đổi vai trò (admin) |
| `/admin/notifications` | Quản lý thông báo | Danh sách đã gửi; **Soạn thông báo** (tiêu đề, nội dung, đối tượng: tất cả/độc giả/nhân viên/một người, hạn hiển thị); sửa/xóa |
| `/admin/forum` | Kiểm duyệt diễn đàn | Hàng đợi báo cáo; ẩn/xóa bài, khóa/ghim chủ đề; quản lý chuyên mục |
| `/admin/settings` | Cài đặt (admin) | Chính sách mượn, mức phạt, thời gian giữ sách… |
| `/admin/audit-logs` | Nhật ký (admin) | Tra cứu hoạt động |

### 4.4 Diễn đàn

| Route | Trang | Nội dung |
|---|---|---|
| `/forum` | Trang chủ diễn đàn | Danh sách chuyên mục (Giới thiệu sách, Hỏi đáp, Review & cảm nhận, Trao đổi/Trao tặng sách, Góp ý thư viện); chủ đề mới/nổi bật; tìm kiếm chủ đề |
| `/forum/c/:slug` | Một chuyên mục | Danh sách chủ đề (ghim lên đầu), sắp xếp mới/nhiều trả lời, phân trang; nút **Tạo chủ đề** |
| `/forum/t/:slug` | Chi tiết chủ đề | Bài gốc (tác giả, thời gian, sách liên quan dạng thẻ nhỏ), nút Thích/Báo cáo; danh sách trả lời (lồng 1 cấp), ô soạn trả lời; chủ đề bị khóa hiện thông báo |
| `/forum/new` | Tạo chủ đề | Chuyên mục, tiêu đề, nội dung (textarea có xem trước markdown cơ bản), gắn sách (ô tìm), thẻ |

Mỗi trang chi tiết sách có khối "Thảo luận về cuốn sách này" liên kết sang diễn đàn.

## 5. Thành phần giao diện tái sử dụng (Vue components)

| Nhóm | Component |
|---|---|
| Khung | `AppNavbar`, `AppFooter`, `AdminSidebar`, `AdminTopbar`, `PublicLayout`, `AdminLayout` |
| Sách | `BookCard` (bìa, tên, tác giả, sao, badge còn/hết, nút nhanh), `BookRow`, `BookCarousel`, `BookFilterPanel`, `BookAvailability`, `RatingStars`, `RatingSummary`, `ReviewItem`, `ReviewForm` |
| Chung | `SearchBar`, `Pagination`, `StatusBadge`, `EmptyState`, `SkeletonCard`, `ConfirmModal`, `FormModal`, `ImageUploader`, `DataTable` (sắp xếp/lọc/phân trang), `StatCard`, `ChartCard`, `DateRangePicker`, `ToastHost` |
| Mượn trả | `CartItem`, `LoanCard`, `LoanTimeline` (các bước: Gửi → Duyệt → Nhận → Trả), `RenewRequestButton`, `RenewalRequestRow`, `ReturnItemRow`, `FineBadge` |
| Thông báo | `NotificationBell`, `NotificationItem`, `RealtimeToast` |
| Diễn đàn | `ThreadList`, `ThreadItem`, `PostItem`, `PostEditor`, `LikeButton`, `ReportModal` |

## 6. Chi tiết tương tác nên có
- **Thẻ sách**: hover hiện nút "Thêm vào giỏ" và "Thêm vào kệ" (mobile: hiện luôn dạng icon).
- **Giỏ mượn** hiển thị số lượng trên navbar, cập nhật tức thì; sách hết hàng trong giỏ được đánh dấu để bỏ.
- **Tìm kiếm**: gợi ý (autocomplete) sau 300 ms (debounce); lưu bộ lọc trên URL query để chia sẻ/quay lại.
- **Yêu cầu gia hạn**: nút bị vô hiệu kèm tooltip giải thích lý do (đã quá hạn / có người đặt trước / hết lượt / đang chờ duyệt). Khi nhân viên duyệt hoặc từ chối, độc giả thấy toast và trạng thái đổi ngay, không cần tải lại.
- **Thông báo realtime**: toast góc phải màn hình, số trên chuông tăng ngay; bấm toast chuyển đến trang liên quan.
- **LoanTimeline** trong lịch sử mượn giúp độc giả hiểu đang ở bước nào.
- **Trang trả sách**: bàn phím nhanh – quét/nhập mã phiếu rồi Enter.
- **Hộp xác nhận** cho: từ chối, xóa, khóa người dùng, miễn phạt.

## 7. Điều hướng & bảo vệ route
- `meta: { requiresAuth, roles: [...] }` trong vue-router; guard chuyển về `/login?redirect=…` nếu chưa đăng nhập, về 403 nếu sai vai trò.
- Pinia store: `auth`, `cart`, `notifications`, `ui`.
- Socket.IO: kết nối sau khi đăng nhập (gửi access token trong `auth`), ngắt khi đăng xuất; tự kết nối lại và đồng bộ số chưa đọc qua API; lắng nghe `notification:new`, `staff:counters`, `loan:updated`.
- Axios interceptor: tự gắn token, tự làm mới khi 401, hiển thị toast với lỗi 4xx/5xx.