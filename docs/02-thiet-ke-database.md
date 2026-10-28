# 02 – Thiết kế Cơ sở dữ liệu (MongoDB)

## 1. Phân tích cấu trúc hiện tại & vấn đề

| Bảng cũ | Vấn đề | Hướng cải thiện |
|---|---|---|
| `Docgia` | Không có tài khoản đăng nhập (email/mật khẩu), không có trạng thái | Gộp vào `users` (role = reader) |
| `NhanVien` | Mật khẩu lưu riêng, tách biệt với độc giả → hai luồng đăng nhập | Gộp vào `users` (role = staff/admin), mật khẩu băm bcrypt |
| `Sach` | `SoQuyen` không phân biệt tổng / còn lại; không có ảnh bìa, mô tả, thể loại, ISBN | Thêm `totalCopies`, `availableCopies`, `cover`, `description`, `categories`, `isbn`… |
| `NhaXuatBan` | Ổn | Giữ nguyên, đổi sang `publishers` |
| `TheoDoiMuonSach` | Mỗi dòng = 1 sách, thiếu trạng thái duyệt, hạn trả, gia hạn, phạt, nhân viên xử lý | Thay bằng `loans` (phiếu mượn) có `items[]` + vòng đời trạng thái |
| (chưa có) | Giỏ, yêu cầu gia hạn, thông báo, đánh giá, kệ, phạt, diễn đàn, đặt trước, cấu hình | Thêm collection mới |

## 2. Quy ước
- Tên collection/field bằng tiếng Anh (camelCase) cho dễ code; bảng đối chiếu ở mục 5.
- Mọi collection có `createdAt`, `updatedAt` (Mongoose `timestamps: true`).
- Tham chiếu bằng `ObjectId` (`ref`). **Embed** dữ liệu nhỏ, luôn đọc cùng nhau (items của phiếu mượn, snapshot tên sách); **reference** dữ liệu lớn hoặc dùng độc lập.
- Mã nghiệp vụ dễ đọc (`DG000001`, `PM000001`, `S000001`) sinh từ collection `counters`.

## 3. Sơ đồ quan hệ (rút gọn)

```
users ─┬─< loans >─ items ──> books >── publishers
       │                         ├──< reviews >── users
       ├─ carts                  ├──── authors (N-N)
       ├─< shelves (bookIds)     ├──── categories (N-N)
       ├─< notifications         └──< reservations >── users
       ├─< fines ──> loans
       ├─< renewalRequests ──> loans
       └─< forumThreads >─< forumPosts
settings, counters, auditLogs (độc lập)
```

## 4. Chi tiết collection

### 4.1 `users` (thay `Docgia` + `NhanVien`)
```js
{
  _id,
  code: "DG000001",            // MaDocGia / MSNV (unique)
  email: String,                // unique, đăng nhập
  passwordHash: String,         // bcrypt
  role: "reader" | "staff" | "admin",
  firstName: String,            // HoLot
  lastName: String,             // Ten (HoTenNV tách ra)
  birthDate: Date,
  gender: "male" | "female" | "other",   // Phai
  address: String,
  phone: String,
  avatar: { url: String, publicId: String },   // Cloudinary
  position: String,             // Chucvu (chỉ staff)
  status: "active" | "locked",
  lockReason: String,
  unpaidFineTotal: Number,      // cache tổng phạt chưa nộp (độc giả)
  lastLoginAt: Date
}
```
Index: `email` (unique), `code` (unique), `{role:1,status:1}`, text index `{firstName,lastName,email,code}`.

### 4.2 `publishers` (NhaXuatBan)
```js
{ code: "NXB001", name: String, address: String }
```
Index: `code` unique, `name`.

### 4.3 `authors`
```js
{ name: String, bio: String, photo: { url: String, publicId: String } }
```
Index: text `name`.

### 4.4 `categories`
```js
{ name: String, slug: String, description: String }
```
Index: `slug` unique.

### 4.5 `books` (Sach)
```js
{
  code: "S000001",             // MaSach
  title: String,               // TenSach
  slug: String,
  isbn: String,
  authors: [ObjectId],         // ref authors
  authorText: String,          // tác giả/nguồn gốc dạng text (giữ NguonGoc/TacGia)
  publisher: ObjectId,         // MaNXB
  publishYear: Number,         // NamXuatBan
  price: Number,               // DonGia (dùng tính phạt mất sách)
  totalCopies: Number,         // SoQuyen (tổng)
  availableCopies: Number,     // còn có thể mượn
  categories: [ObjectId],
  language: String,
  pages: Number,
  description: String,
  cover: { url: String, publicId: String },  // ảnh bìa trên Cloudinary
  location: String,            // vị trí kệ: "A2-03"
  ratingAvg: Number,           // cache
  ratingCount: Number,
  borrowCount: Number,         // cache, phục vụ "phổ biến"
  status: "active" | "hidden"
}
```
Index: text `{title, authorText}` (đặt `default_language: "none"`; text index không phân biệt dấu nên tìm "nguyen" vẫn khớp "Nguyễn"), `slug` unique, `code` unique, `{categories:1}`, `{authors:1}`, `{borrowCount:-1}`, `{createdAt:-1}`.
Ràng buộc: `0 ≤ availableCopies ≤ totalCopies`. Cập nhật tồn kho bằng `findOneAndUpdate({_id, availableCopies:{$gte:1}}, {$inc:{availableCopies:-1}})` để tránh mượn quá số lượng.

### 4.6 `carts` (giỏ mượn)
```js
{ user: ObjectId (unique), items: [{ book: ObjectId, addedAt: Date }] }
```

### 4.7 `loans` (phiếu mượn – thay `TheoDoiMuonSach`)
```js
{
  code: "PM000001",
  reader: ObjectId,
  status: "pending" | "approved" | "borrowing" | "overdue" |
          "returned" | "rejected" | "cancelled" | "expired",
  items: [{
    book: ObjectId,
    titleSnapshot: String,     // lưu tên/đơn giá lúc mượn
    priceSnapshot: Number,
    status: "pending" | "borrowing" | "returned" | "lost",
    borrowDate: Date,          // NgayMuon
    dueDate: Date,             // hạn trả
    returnDate: Date,          // NgayTra
    renewCount: Number,
    renewals: [{ at: Date, oldDue: Date, newDue: Date, approvedBy: ObjectId }],  // lịch sử các lần gia hạn đã được duyệt
    condition: "good" | "damaged" | "lost"   // khi trả
  }],
  requestNote: String,
  expectedPickupDate: Date,
  pickupDeadline: Date,
  rejectReason: String,
  approvedBy: ObjectId,        // staff duyệt
  handedOverBy: ObjectId,      // staff giao
  returnedBy: ObjectId,        // staff nhận trả
  approvedAt: Date, handedOverAt: Date, closedAt: Date
}
```
Index: `code` unique, `{reader:1,status:1}`, `{status:1,createdAt:-1}`, `{"items.dueDate":1,status:1}` (cron quá hạn), `{pickupDeadline:1}`.

### 4.7b `renewalRequests` (yêu cầu gia hạn – chờ nhân viên duyệt)
```js
{
  loan: ObjectId, book: ObjectId, reader: ObjectId,
  currentDueDate: Date,        // hạn trả tại thời điểm gửi
  requestedDueDate: Date,      // = currentDueDate + renewDays
  reason: String,              // lý do độc giả nêu (tùy chọn)
  status: "pending" | "approved" | "rejected" | "cancelled",
  rejectReason: String,
  decidedBy: ObjectId, decidedAt: Date
}
```
Index: `{status:1, createdAt:-1}` (hàng đợi duyệt), `{reader:1, createdAt:-1}`; **partial unique** `{loan:1, book:1}` khi `status = "pending"` (mỗi quyển chỉ 1 yêu cầu chờ).

### 4.8 `fines`
```js
{
  reader: ObjectId, loan: ObjectId, book: ObjectId,
  type: "late" | "damaged" | "lost" | "other",
  daysLate: Number,
  amount: Number,
  reason: String,
  status: "unpaid" | "paid" | "waived",
  recordedBy: ObjectId,        // null nếu tự động
  paidAt: Date, paidConfirmedBy: ObjectId,
  waivedReason: String
}
```
Index: `{reader:1,status:1}`, `{loan:1}`.

### 4.9 `reservations` (đặt trước)
```js
{
  reader: ObjectId, book: ObjectId,
  status: "waiting" | "available" | "fulfilled" | "expired" | "cancelled",
  notifiedAt: Date, holdUntil: Date
}
```
Index: `{book:1,status:1,createdAt:1}` (hàng chờ FIFO), unique `{reader,book}` khi `status in (waiting,available)` (partial index).

### 4.10 `reviews`
```js
{
  book: ObjectId, reader: ObjectId,
  rating: Number (1–5), comment: String,
  hidden: Boolean, hiddenBy: ObjectId
}
```
Index: unique `{book:1, reader:1}`, `{book:1,createdAt:-1}`.

**Điều kiện tạo đánh giá (bắt buộc):** tồn tại `loans` của `reader` có `items` với `book` đó ở trạng thái `borrowing` / `returned` / `lost`. Kiểm tra ở service, không tin client; nếu không thỏa → 403.

### 4.11 `shelves` (kệ sách của tôi)
```js
{
  user: ObjectId,
  name: String,
  type: "want" | "reading" | "read" | "custom",
  items: [{ book: ObjectId, addedAt: Date }]
}
```
Index: `{user:1}`; unique `{user:1,name:1}`.

### 4.12 `notifications`
```js
{
  recipient: ObjectId | null,  // null = thông báo chung cho tất cả
  audience: "user" | "all" | "readers" | "staff",
  type: "loan" | "renewal" | "due" | "overdue" | "fine" | "reservation" | "forum" | "system",
  title: String, content: String,
  link: String,                // route trong app
  createdBy: ObjectId,         // null nếu hệ thống
  expiresAt: Date
}
```
Vì thông báo chung gửi cho nhiều người, trạng thái đọc lưu riêng:

### 4.13 `notificationReads`
```js
{ user: ObjectId, notification: ObjectId, readAt: Date }
```
Index unique `{user:1, notification:1}`. (Cách khác đơn giản hơn: khi gửi thông báo chung thì fan-out tạo bản ghi `recipient` cho từng người, thêm `isRead`; chọn cách này nếu số người dùng nhỏ.)

**Đẩy realtime bằng Socket.IO:** `notify.service` tạo bản ghi `notifications` rồi `io.to("user:<id>").emit("notification:new", …)`; thông báo cho nhân viên đẩy tới phòng `role:staff`. DB là nguồn sự thật, Socket chỉ để báo tức thì (client mất kết nối vẫn đọc lại được từ API).

### 4.14 Diễn đàn
**`forumCategories`**
```js
{ name, slug, description, order: Number }
```
**`forumThreads`**
```js
{
  category: ObjectId, author: ObjectId,
  title: String, slug: String, content: String,
  book: ObjectId | null,       // gắn sách (tùy chọn)
  tags: [String],
  pinned: Boolean, locked: Boolean,
  replyCount: Number, likeCount: Number, viewCount: Number,
  lastReplyAt: Date, lastReplyBy: ObjectId,
  likes: [ObjectId],
  status: "active" | "hidden"
}
```
**`forumPosts`** (bình luận/trả lời)
```js
{
  thread: ObjectId, author: ObjectId,
  parent: ObjectId | null,     // trả lời lồng 1 cấp
  content: String,
  likes: [ObjectId], likeCount: Number,
  status: "active" | "hidden"
}
```
**`forumReports`**
```js
{ targetType: "thread" | "post", targetId: ObjectId, reporter: ObjectId,
  reason: String, status: "open" | "resolved" | "dismissed", handledBy: ObjectId }
```
Index: threads `{category:1,pinned:-1,lastReplyAt:-1}`, text `{title,content}`; posts `{thread:1,createdAt:1}`.

### 4.15 `settings` (1 document)
```js
{
  maxBooksPerLoan: 5, loanDays: 14,
  maxRenewals: 2, renewDays: 7,
  pickupHoldDays: 3, reservationHoldDays: 3,
  lateFeePerDay: 2000, lostBookFeeRate: 1.0, lostBookProcessingFee: 20000
}
```

### 4.16 `counters`
```js
{ _id: "loan" | "user" | "book", seq: Number }
```

### 4.17 `auditLogs`
```js
{ actor: ObjectId, action: String, targetType: String, targetId: ObjectId,
  detail: Object, ip: String }
```

### 4.18 `refreshTokens` (tùy chọn)
```js
{ user: ObjectId, tokenHash: String, expiresAt: Date (TTL index), userAgent: String }
```

## 5. Bảng đối chiếu schema cũ → mới

| Cũ | Mới |
|---|---|
| Docgia.MaDocGia, HoLot, Ten, NgaySinh, Phai, DiaChi, DienThoai | users.code, firstName, lastName, birthDate, gender, address, phone (+ email, passwordHash) |
| NhanVien.MSNV, HoTenNV, Password, Chucvu, Diachi, SoDienThoai | users (role staff/admin): code, firstName+lastName, passwordHash, position, address, phone |
| Sach.MaSach, TenSach, DonGia, SoQuyen, NamXuatBan, MaNXB, NguonGoc/TacGia | books.code, title, price, totalCopies (+availableCopies), publishYear, publisher, authorText/authors |
| NhaXuatBan.MaNXB, TenNXB, DiaChi | publishers.code, name, address |
| TheoDoiMuonSach.MaDocGia, MaSach, NgayMuon, NgayTra | loans.reader, items[].book, items[].borrowDate, items[].returnDate |

## 6. Giao dịch & tính toàn vẹn
- **Đã chốt dùng MongoDB transaction** cho: duyệt, giao, trả, hủy/hết hạn, duyệt gia hạn (khi vừa sửa `books` vừa sửa `loans`/`fines`/`renewalRequests`). Cần replica set: MongoDB Atlas có sẵn; chạy local dùng Atlas free hoặc docker-compose replica set một node (xem file 05).
- Nếu không dùng transaction: cập nhật tồn kho bằng thao tác nguyên tử có điều kiện (`$gte`), và có bước bù trừ khi lỗi.
- Cache (`ratingAvg`, `borrowCount`, `unpaidFineTotal`) cập nhật cùng lúc với thao tác gốc; có script `recalculate` để đồng bộ lại khi cần.

## 7. Dữ liệu seed
- 1 admin, 2 nhân viên, 20 độc giả.
- 8–10 thể loại, 15 tác giả, 5 NXB, 50–100 sách (có ảnh bìa).
- Vài phiếu mượn ở đủ các trạng thái, vài phạt, vài đánh giá, 4 chuyên mục diễn đàn và vài chủ đề mẫu.
- Script `npm run seed` (dùng @faker-js/faker cho dữ liệu giả).
